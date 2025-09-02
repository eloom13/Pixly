using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Pixly.Services.Database
{
    public class ApplicationDbContext : IdentityDbContext<User>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Photo> Photos { get; set; }
        public DbSet<Tag> Tags { get; set; }
        public DbSet<PhotoTag> PhotoTags { get; set; }
        public DbSet<Like> Likes { get; set; }
        public DbSet<Favorite> Favorites { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<Report> Reports { get; set; }
        public DbSet<ReportType> ReportTypes { get; set; }
        public DbSet<ReportStatus> ReportStatuses { get; set; }
        public DbSet<Purchase> Purchases { get; set; }
        public DbSet<PlatformEarning> PlatformEarnings { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Ignore<IdentityUserLogin<string>>();
            modelBuilder.Ignore<IdentityRoleClaim<string>>();
            modelBuilder.Ignore<IdentityRole<string>>();

            modelBuilder.Entity<Tag>()
                .HasIndex(t => t.Name)
                .IsUnique()
                .HasDatabaseName("IX_Tag_Name");

            DataSeed.Seed(modelBuilder);
            DataSeed.SeedRoles(modelBuilder);
        }
    }
}
