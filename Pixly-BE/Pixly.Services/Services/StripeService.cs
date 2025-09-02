using MapsterMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pixly.Models.DTOs;
using Pixly.Services.Database;
using Pixly.Services.Exceptions;
using Pixly.Services.Interfaces;
using Stripe;
using Stripe.Checkout;

namespace Pixly.Services.Services
{
    public class StripeService
    {
        private readonly IConfiguration _configuration;
        private readonly ApplicationDbContext _context;
        private readonly ILogger<StripeService> _logger;
        private readonly IMapper _mapper;
        private readonly ICacheService _cacheService;

        public StripeService(
            IConfiguration configuration,
            ApplicationDbContext context,
            ILogger<StripeService> logger,
            IMapper mapper,
            ICacheService cacheService)
        {
            _configuration = configuration;
            _context = context;
            _logger = logger;
            _mapper = mapper;
            _cacheService = cacheService;

            StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"];
        }

        public async Task<Session> CreatePhotoCheckoutSessionAsync(
    int photoId, string userId, decimal amount, string successUrl, string cancelUrl)
        {
            _logger.LogInformation("Creating checkout session for photo {PhotoId} and user {UserId} with amount {Amount}", photoId, userId, amount);

            if (amount <= 0)
                throw new ValidationException("Amount must be greater than zero", null);

            var photo = await _context.Photos
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.PhotoId == photoId);

            if (photo == null)
                throw new NotFoundException($"Photo with ID {photoId} not found");

            if (photo.State != "Approved")
                throw new ValidationException("Photo is not available for purchase", null);

            var existingPurchase = await _context.Purchases
                .FirstOrDefaultAsync(p => p.PhotoId == photoId && p.UserId == userId && p.Status == "Completed");

            if (existingPurchase != null)
                throw new ConflictException("Photo already purchased by this user");

            try
            {
                var options = new SessionCreateOptions
                {
                    PaymentMethodTypes = new List<string> { "card" },
                    LineItems = new List<SessionLineItemOptions>
            {
                new SessionLineItemOptions
                {
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = "usd",
                        UnitAmount = (long)(amount * 100),
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = $"Photo: {photo.Title}",
                            Images = new List<string> { photo.Url },
                            Description = photo.Description ?? "High-quality photo download",
                        }
                    },
                    Quantity = 1
                }
            },
                    Mode = "payment",
                    SuccessUrl = successUrl,
                    CancelUrl = cancelUrl,
                    Metadata = new Dictionary<string, string>
            {
                { "photoId", photoId.ToString() },
                { "userId", userId },
                { "photoTitle", photo.Title },
                { "amount", amount.ToString("F2") }
            }
                };

                var service = new SessionService();
                var session = await service.CreateAsync(options);

                await CreatePendingPurchaseAsync(photoId, userId, session.Id, amount);

                await CompletePurchaseAsync(session.Id);

                _logger.LogInformation("Checkout session created and purchase completed immediately: {SessionId}", session.Id);
                return session;
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe error creating checkout session");
                throw new ExternalServiceException($"Payment service error: {ex.Message}");
            }
        }


        public async Task<bool> VerifyPaymentAsync(string sessionId)
        {
            try
            {
                var service = new SessionService();
                var session = await service.GetAsync(sessionId);

                if (session.PaymentStatus == "paid")
                {
                    await CompletePurchaseAsync(sessionId);
                    return true;
                }

                return false;
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Error verifying payment for session {SessionId}", sessionId);
                throw new ExternalServiceException($"Payment verification error: {ex.Message}");
            }
        }

        public async Task<PaymentResult> ProcessPaymentWebhookAsync(string payload, string signature)
        {
            // Webhook functionality removed - using manual verification instead
            throw new NotImplementedException("Webhook processing not configured. Use VerifyPaymentAsync instead.");
        }

        public async Task<List<Models.DTOs.Purchase>> GetUserPurchasesAsync(string userId)
        {
            var cacheKey = $"user_purchases:{userId}";

            return await _cacheService.GetOrCreateAsync(cacheKey, async () =>
            {
                var purchases = await _context.Purchases
                    .Include(p => p.Photo)
                    .Where(p => p.UserId == userId && p.Status == "Completed")
                    .OrderByDescending(p => p.PurchasedAt)
                    .ToListAsync();

                return _mapper.Map<List<Models.DTOs.Purchase>>(purchases);
            }, TimeSpan.FromMinutes(10));
        }

        public async Task<Models.DTOs.Purchase> GetPurchaseBySessionIdAsync(string sessionId)
        {
            var purchase = await _context.Purchases
                .Include(p => p.Photo)
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.StripeSessionId == sessionId);

            if (purchase == null)
                throw new NotFoundException($"Purchase with session ID {sessionId} not found");

            return _mapper.Map<Models.DTOs.Purchase>(purchase);
        }

        private async Task CreatePendingPurchaseAsync(int photoId, string userId, string sessionId, decimal amount)
        {
            var purchase = new Database.Purchase
            {
                PhotoId = photoId,
                UserId = userId,
                StripeSessionId = sessionId,
                Amount = amount,
                Currency = "USD",
                Status = "Pending",
                CreatedAt = DateTime.UtcNow
            };

            _context.Purchases.Add(purchase);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Pending purchase created for photo {PhotoId}, user {UserId}, session {SessionId}",
                photoId, userId, sessionId);
        }

        private async Task CompletePurchaseAsync(string sessionId)
        {
            var purchase = await _context.Purchases
                .Include(p => p.Photo)
                .FirstOrDefaultAsync(p => p.StripeSessionId == sessionId);

            if (purchase == null)
            {
                _logger.LogWarning("Purchase not found for session {SessionId}", sessionId);
                return;
            }
            if (purchase.Status == "Completed")
            {
                _logger.LogInformation("Purchase already completed for session {SessionId}", sessionId);
                return;
            }

            purchase.Status = "Completed";
            purchase.PurchasedAt = DateTime.UtcNow;
            purchase.Photo.DownloadCount++;

            var platformCut = Math.Round(purchase.Amount * 0.20m, 2, MidpointRounding.AwayFromZero);

            var platformEarning = await _context.PlatformEarnings.FirstOrDefaultAsync();
            if (platformEarning == null)
            {
                platformEarning = new PlatformEarning
                {
                    TotalEarnings = platformCut,
                    LastUpdated = DateTime.UtcNow
                };
                _context.PlatformEarnings.Add(platformEarning);
            }
            else
            {
                platformEarning.TotalEarnings += platformCut;
                platformEarning.LastUpdated = DateTime.UtcNow;
                _context.PlatformEarnings.Update(platformEarning);
            }

            await _context.SaveChangesAsync();

            await _cacheService.RemoveAsync($"user_purchases:{purchase.UserId}");

            _logger.LogInformation(
                "Purchase completed for session {SessionId}, photo {PhotoId}. Platform +{PlatformCut}",
                sessionId, purchase.PhotoId, platformCut);
        }

    }
}