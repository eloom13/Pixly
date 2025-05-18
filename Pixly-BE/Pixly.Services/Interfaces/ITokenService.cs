﻿using Pixly.Models.Response;
using Pixly.Services.Database;
using System.Security.Claims;

namespace Pixly.Services.Interfaces
{
    public interface ITokenService
    {
        Task<string> GenerateJwtTokenAsync(User user);
        Task<string> GenerateRefreshTokenAsync(User user, string ipAddress = null);
        Task<User> ValidateRefreshTokenAsync(string token, string refreshToken, string ipAddress = null);
        Task<AuthResponse> RotateRefreshTokenAsync(string jwtToken, string refreshToken, string userId, string ipAddress = null);
        Task RevokeRefreshTokenAsync(string refreshToken, string userId, string ipAddress = null, string reason = null);
        Task RevokeAllRefreshTokensAsync(string userId, string ipAddress = null, string reason = null);
        ClaimsPrincipal GetPrincipalFromExpiredToken(string token);
    }
}
