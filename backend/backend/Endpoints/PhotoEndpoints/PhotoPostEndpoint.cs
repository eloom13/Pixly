﻿using backend.Data.Models;
using backend.Heleper.Api;
using backend.Helper.DTO_s;
using backend.Helper.Services;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;

namespace backend.Endpoints.PhotoEndpoints
{

    [Route("api/photos")]
    public class PhotoPostEndpoint : MyEndpointBaseAsync.WithRequest<PostPhotoRequest>.WithResult<PostPhotoResult>
    {
        private readonly PhotoService _photoService;

        public PhotoPostEndpoint(PhotoService photoService)
        {
            _photoService = photoService;
        }

      
        [HttpPost]
        public override async Task<PostPhotoResult> HandleAsync( [FromForm] PostPhotoRequest request, CancellationToken cancellationToken = default)
        {
            
            if (request.File == null || request.File.Length == 0)
            {
                return new PostPhotoResult
                {
                    Message = "File is required",
                    PhotoId = null,
                };
            }

            var categories = request.Categories
                .Select(categoryJson => JsonConvert.DeserializeObject<CategoryDTO>(categoryJson))
                .ToList();

            try
            {
               
                var photo = await _photoService.UploadPhotoAsync(
                    request.Title,
                    request.Description,
                    request.Location,
                    request.UserId,
                    request.File,
                    request.Tags,
                    categories,
                    cancellationToken
                );

                return new PostPhotoResult
                {
                    Message = "Uspjesno iz endpointa",
                    PhotoId = photo.PhotoId,
                };
            }
            catch (Exception ex)
            {
                
                return new PostPhotoResult
                {
                    Message = $"Error: {ex.Message}\nStack Trace: {ex.StackTrace}",
                    PhotoId = null,
                };
            }
        }
    }

   
    public class PostPhotoRequest
    {
        public string Title { get; set; }
        public string Description { get; set; }
        public string Location { get; set; }
        public int UserId { get; set; }
        public IFormFile File { get; set; } 

        public List<string> Tags { get; set; } = new List<string>();

        public List<string> Categories { get; set; } = new List<string>();
 
    }


    public class PostPhotoResult
    {
        public string? Message { get; set; }
        public int? PhotoId { get; set; }
    }


   
}
