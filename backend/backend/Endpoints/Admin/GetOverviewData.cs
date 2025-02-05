using backend.Data;
using backend.Heleper.Api;
using Microsoft.AspNetCore.Mvc;

namespace backend.Endpoints.Admin
{
    [Route("api/dashboard/overview")]
    public class GetOverviewData : MyEndpointBaseAsync.WithoutRequest.WithResult<OverviewResult>
    {
        private readonly AppDbContext _db;

        public GetOverviewData(AppDbContext db)
        {
            _db = db;
        }


        [HttpGet]
        public override async Task<OverviewResult> HandleAsync(CancellationToken cancellationToken = default)
        {
            var users =  _db.Users.Count();
            var images = _db.Photos.Count();
            return new OverviewResult
            {
                Revenue = 236,
                TotalViews = 79,
                Downloads = 178,
                TotalUsers = users,
                TotalImages = images,
            };
        }
    }

    public class OverviewResult
    {
        public int Revenue { get; set; }
        public int TotalViews { get; set; }
        public int Downloads { get; set; }
        public int TotalUsers { get; set; }
        public int TotalImages { get; set; }
    }
}
