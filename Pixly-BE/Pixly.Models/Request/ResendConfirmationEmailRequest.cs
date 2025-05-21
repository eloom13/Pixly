﻿using System.ComponentModel.DataAnnotations;

namespace Pixly.Models.Request
{
    public class ResendConfirmationEmailRequest
    {
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email format")]
        public string Email { get; set; }
    }
}
