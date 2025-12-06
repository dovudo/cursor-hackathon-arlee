import { mutation } from "../_generated/server";

export const seedStyles = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("styles").collect();
    
    // If styles exist, update them instead of skipping
    if (existing.length > 0) {
      console.log(`[seedStyles] Found ${existing.length} existing styles, updating...`);
    }

    // Supabase Storage base URL for style previews (from production)
    const SUPABASE_STORAGE_BASE = "https://eesunpljunhoaggrobpo.supabase.co/storage/v1/object/public/resources/style_preview_horizontal";

    // Helper function to get image URL from Supabase Storage
    const getImageUrl = (styleName: string) => {
      // Convert style name to snake_case filename
      const filename = styleName
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      return `${SUPABASE_STORAGE_BASE}/${filename}.webp`;
    };

    const styles = [
      // Realistic Image Styles
      {
        name: "Cinematic",
        description: "Epic, dramatic storytelling with rich visuals",
        prompt: "cinematic lighting, dramatic composition, film grain, professional photography, movie scene",
        imageUrl: getImageUrl("Cinematic"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Documentary",
        description: "Realistic, authentic documentary style",
        prompt: "documentary style, authentic interview setting, natural lighting, real people, soft natural daylight photography with realistic surface textures",
        imageUrl: getImageUrl("Documentary"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Minimalist",
        description: "Clean, simple, modern aesthetic",
        prompt: "minimalist style, clean composition, simple design, modern aesthetic, white space, minimalistic lifestyle photography with slow living aesthetic",
        imageUrl: getImageUrl("Minimalist"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Enterprise",
        description: "Modern corporate photography with clean business aesthetics",
        prompt: "professional corporate photography with sleek modern business aesthetics featuring clean architectural lines and contemporary office environments",
        imageUrl: getImageUrl("Enterprise"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Studio Portrait",
        description: "Professional studio portrait photography with three-point lighting",
        prompt: "professional studio portrait photography with three-point lighting configuration featuring sharp focus and seamless neutral backdrop",
        imageUrl: getImageUrl("Studio Portrait"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Urban Drama",
        description: "Dramatic city photography during nighttime",
        prompt: "dramatic city photography during nighttime with neon light reflections on wet asphalt surfaces creating gritty urban realism and metropolitan atmosphere",
        imageUrl: getImageUrl("Urban Drama"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Natural Light",
        description: "Natural daylight photography with soft authentic lighting",
        prompt: "soft natural daylight photography with realistic surface textures and gentle contrast creating authentic lighting conditions",
        imageUrl: getImageUrl("Natural Light"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Evening Light",
        description: "Natural evening lighting with warm golden tones",
        prompt: "golden hour photography captured during magical evening sunlight with warm amber illumination creating long dramatic shadows across landscapes",
        imageUrl: getImageUrl("Evening Light"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Black and White",
        description: "Classic black and white analog photography with dramatic contrast",
        prompt: "classic black and white photography with rich tonal contrast between deep shadows and bright highlights, featuring authentic analog film grain texture",
        imageUrl: getImageUrl("Black and White"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Forest Life",
        description: "Natural forest photography with organic woodland atmosphere",
        prompt: "natural forest photography with ambient dappled sunlight filtering through dense tree canopy creating complex light and shadow patterns",
        imageUrl: getImageUrl("Forest Life"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Retro Realism",
        description: "Authentic 1980s analog film photography with vintage colors",
        prompt: "authentic 1980s analog film photography with realistic film grain texture and period-appropriate colors showing vintage photographic quality",
        imageUrl: getImageUrl("Retro Realism"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Organic Calm",
        description: "Minimalistic lifestyle photography with organic calm elements",
        prompt: "minimalistic lifestyle photography with slow living aesthetic featuring natural textures and sustainable materials creating serene atmosphere",
        imageUrl: getImageUrl("Organic Calm"),
        isPublic: true,
        createdAt: Date.now(),
      },
      // Animation Styles
      {
        name: "2D Cartoon",
        description: "Bright 2D cartoon style, animated look",
        prompt: "bright 2d cartoon style, animated look, colorful design, children content",
        imageUrl: getImageUrl("2D Cartoon"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "3D Animation",
        description: "Modern 3D animation style, rendered graphics",
        prompt: "modern 3d animation style, rendered graphics, professional animated content",
        imageUrl: getImageUrl("3D Animation"),
        isPublic: true,
        createdAt: Date.now(),
      },
      // Digital Illustration Styles
      {
        name: "Pop Art",
        description: "Pop art illustration with halftones and commercial aesthetics",
        prompt: "pop art style illustration with halftone dot patterns and Ben-Day printing technique showing bright contrasting colors and comic book aesthetics",
        imageUrl: getImageUrl("Pop Art"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Street Art",
        description: "Street art with graffiti and stencil techniques",
        prompt: "street art style illustration with stencil techniques and spray-paint aesthetic showing urban texture elements and graffiti culture influences",
        imageUrl: getImageUrl("Street Art"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Neon Calm",
        description: "Soft neon glow with pastel synthwave aesthetic",
        prompt: "soft neon glow illustration with synthwave pastel color palette and gentle gradient transitions creating peaceful electronic aesthetic",
        imageUrl: getImageUrl("Neon Calm"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Child Book",
        description: "Friendly children's book illustration with soft watercolor",
        prompt: "children's book illustration with soft watercolor techniques and gentle edge treatments creating friendly approachable aesthetics for young audiences",
        imageUrl: getImageUrl("Child Book"),
        isPublic: true,
        createdAt: Date.now(),
      },
      // Vector Illustration Styles
      {
        name: "Bold Stroke",
        description: "Vector illustration with bold thick strokes",
        prompt: "vector illustration with bold thick stroke lines and high-contrast flat color areas creating poster-like visual impact and strong graphic design presence",
        imageUrl: getImageUrl("Bold Stroke"),
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Line Art",
        description: "Clean mono-line vector art with minimal stroke variation",
        prompt: "clean mono-line vector art with minimal stroke weight variation and precise line work showing editorial illustration style and contemporary minimalist design approach",
        imageUrl: getImageUrl("Line Art"),
        isPublic: true,
        createdAt: Date.now(),
      },
    ];

    let inserted = 0;
    let updated = 0;

    for (const style of styles) {
      // Check if style with this name already exists
      const existingStyle = existing.find((s) => s.name === style.name);
      
      if (existingStyle) {
        // Update existing style
        await ctx.db.patch(existingStyle._id, {
          description: style.description,
          prompt: style.prompt,
          imageUrl: style.imageUrl,
          isPublic: style.isPublic,
        });
        updated++;
      } else {
        // Insert new style
        await ctx.db.insert("styles", style);
        inserted++;
      }
    }

    return { 
      message: `Successfully processed ${styles.length} styles`,
      inserted,
      updated,
      total: styles.length
    };
  },
});
