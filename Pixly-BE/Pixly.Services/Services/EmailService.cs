﻿using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pixly.Models.DTOs;
using Pixly.Services.Interfaces;
using Pixly.Services.Settings;
using System.Net;
using System.Net.Mail;

namespace Pixly.Services.Services
{
    public class EmailService : IEmailService
    {
        private readonly SMTPSettings _smtpSettings;
        private readonly ILogger<EmailService> _logger;
        private readonly IMessageBrokerService _messageBroker;
        private const string EmailQueue = "email_queue";
        private const string ConfirmationEmailQueue = "confirmation_email_queue";

        public EmailService(
            IOptions<SMTPSettings> smtpSettings,
            ILogger<EmailService> logger,
            IMessageBrokerService messageBroker)
        {
            _smtpSettings = smtpSettings.Value;
            _logger = logger;
            _messageBroker = messageBroker;
        }

        public async Task SendEmailAsync(string to, string subject, string htmlBody)
        {
            try
            {
                var message = new MailMessage
                {
                    From = new MailAddress(_smtpSettings.FromEmail, _smtpSettings.FromName),
                    Subject = subject,
                    Body = htmlBody,
                    IsBodyHtml = true
                };

                message.To.Add(new MailAddress(to));

                using var client = new SmtpClient(_smtpSettings.Host, _smtpSettings.Port)
                {
                    Credentials = new NetworkCredential(_smtpSettings.Username, _smtpSettings.Password),
                    EnableSsl = _smtpSettings.EnableSsl
                };

                await client.SendMailAsync(message);
                _logger.LogInformation("Email sent successfully to {Email}", to);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending email to {Email}", to);
                throw;
            }
        }

        public async Task SendEmailConfirmationAsync(string email, string confirmationLink)
        {
            string subject = "Confirm Your Email Address";
            string body = $@"
                <html>
                <body>
                    <h2>Please confirm your email address</h2>
                    <p>Thank you for registering. Please confirm your email by clicking the link below:</p>
                    <p><a href='{confirmationLink}'>Confirm Email</a></p>
                    <p>If you didn't request this email, please ignore it.</p>
                </body>
                </html>";

            await SendEmailAsync(email, subject, body);
        }

        public async Task SendPasswordResetLinkAsync(string email, string resetLink)
        {
            string subject = "Password Reset";
            string body = $@"
                <html>
                <body>
                    <h2>Password Reset Request</h2>
                    <p>You've requested to reset your password. Please click the link below to reset it:</p>
                    <p><a href='{resetLink}'>Reset Password</a></p>
                    <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
                </body>
                </html>
            ";

            await SendEmailAsync(email, subject, body);
        }
        public void QueueEmailAsync(string to, string subject, string htmlBody)
        {
            var message = new EmailMessage
            {
                To = to,
                Subject = subject,
                HtmlBody = htmlBody
            };

            _messageBroker.PublishEmailMessage(EmailQueue, message);
            _logger.LogInformation("Email queued for {Email}", to);
        }

        public void QueueEmailConfirmationAsync(string email, string confirmationLink)
        {
            var message = new EmailConfirmationMessage
            {
                Email = email,
                ConfirmationLink = confirmationLink
            };

            _messageBroker.PublishEmailMessage(ConfirmationEmailQueue, message);
            _logger.LogInformation("Confirmation email queued for {Email}", email);
        }

        public void QueuePasswordResetLinkAsync(string email, string resetLink)
        {
            string subject = "Password Reset";
            string body = $@"
                <html>
                <body>
                    <h2>Password Reset Request</h2>
                    <p>You've requested to reset your password. Please click the link below to reset it:</p>
                    <p><a href='{resetLink}'>Reset Password</a></p>
                    <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
                </body>
                </html>";

            QueueEmailAsync(email, subject, body);
        }

        public async Task Send2FACodeAsync(string email, string code)
        {
            string subject = "Your Two-Factor Authentication Code";
            string body = $@"
        <html>
        <body>
            <h2>Your Authentication Code</h2>
            <p>Here is your two-factor authentication code:</p>
            <h1 style='letter-spacing: 2px; font-family: monospace; padding: 10px; background-color: #f4f4f4; display: inline-block;'>{code}</h1>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email and secure your account.</p>
        </body>
        </html>";

            await SendEmailAsync(email, subject, body);
        }

        public void Queue2FACodeAsync(string email, string code)
        {
            string subject = "Your Two-Factor Authentication Code";
            string body = $@"
        <html>
        <body>
            <h2>Your Authentication Code</h2>
            <p>Here is your two-factor authentication code:</p>
            <h1 style='letter-spacing: 2px; font-family: monospace; padding: 10px; background-color: #f4f4f4; display: inline-block;'>{code}</h1>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email and secure your account.</p>
        </body>
        </html>";

            QueueEmailAsync(email, subject, body);
        }
    }
}
