﻿using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Pixly.Models.Request;
using Pixly.Models.Response;
using Pixly.Services.Database;
using Pixly.Services.Exceptions;
using Pixly.Services.Interfaces;
using System.Security.Authentication;

namespace Pixly.Services.Services
{
    public class TwoFactorService : ITwoFactorService
    {
        private readonly UserManager<User> _userManager;
        private readonly ITokenService _tokenService;
        private readonly ILogger<TwoFactorService> _logger;
        private readonly IDistributedCache _cache;

        public TwoFactorService(
            UserManager<User> userManager,
            ITokenService tokenService,
            ILogger<TwoFactorService> logger,
            IDistributedCache cache)
        {
            _userManager = userManager;
            _tokenService = tokenService;
            _logger = logger;
            _cache = cache;
        }

        public async Task<bool> SetupTwoFactorAsync(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                _logger.LogWarning("User with ID {UserId} not found during 2FA setup", userId);
                throw new NotFoundException($"User with ID {userId} not found.");
            }

            var result = await _userManager.SetTwoFactorEnabledAsync(user, true);
            if (!result.Succeeded)
            {
                var errors = result.Errors.Select(e => e.Description).ToList();
                _logger.LogWarning("Failed to set up 2FA for user {UserId}: {Errors}", userId, string.Join(", ", errors));
                throw new ValidationException("Error setting up 2FA", errors);
            }

            _logger.LogInformation("2FA successfully set up for user {UserId}", userId);
            return true;
        }

        public async Task<string> GenerateTwoFactorCodeAsync(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                _logger.LogWarning("User with ID {UserId} not found during 2FA code generation", userId);
                throw new NotFoundException($"User with ID {userId} not found.");
            }

            var code = GenerateRandomCode();

            var cacheKey = $"2FA_{userId}";
            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1)
            };

            await _cache.SetStringAsync(cacheKey, code, cacheOptions);

            _logger.LogInformation("2FA code generated for user {UserId}", userId);
            return code;
        }

        public async Task<AuthResponse> ValidateTwoFactorAsync(TwoFactorRequest request)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
            {
                _logger.LogWarning("User with email {Email} not found during 2FA validation", request.Email);
                throw new NotFoundException("User with this email does not exist");
            }

            var cacheKey = $"2FA_{user.Id}";
            var storedCode = await _cache.GetStringAsync(cacheKey);

            if (string.IsNullOrEmpty(storedCode))
            {
                _logger.LogWarning("2FA code not found or expired for user {UserId}", user.Id);
                throw new AuthenticationException("Verification code expired or not found. Please request a new code.");
            }

            if (storedCode != request.TwoFactorCode)
            {
                _logger.LogWarning("Invalid 2FA code for user {Email}", request.Email);
                throw new AuthenticationException("Invalid verification code");
            }

            await _cache.RemoveAsync(cacheKey);
            _logger.LogInformation("2FA code successfully verified for user {UserId}", user.Id);

            var jwtToken = await _tokenService.GenerateJwtTokenAsync(user);
            var refreshToken = await _tokenService.GenerateRefreshTokenAsync(user);

            return new AuthResponse
            {
                Token = jwtToken,
                RefreshToken = refreshToken,
                Expiration = DateTime.UtcNow.AddMinutes(15),
                RequiresTwoFactor = false,
                EmailConfirmed = user.EmailConfirmed
            };
        }

        private string GenerateRandomCode()
        {
            return new Random().Next(100000, 999999).ToString();
        }
    }
}
