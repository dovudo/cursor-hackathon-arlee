// Simple test script to verify Convex functions
const { ConvexHttpClient } = require("convex/browser");

async function testConvex() {
  const client = new ConvexHttpClient(process.env.CONVEX_URL || "https://adventurous-cow-755.convex.cloud");
  
  console.log("Testing Convex connection...");
  
  try {
    // Test 1: Check connection
    const testResult = await client.query("functions/test:testQuery", {});
    console.log("✅ Test query:", testResult);
    
    // Test 2: Get styles (should be empty initially)
    const styles = await client.query("functions/styles:getPublicStyles", {});
    console.log("✅ Styles:", styles.length, "found");
    
    // Test 3: Seed styles (if not already seeded)
    if (styles.length === 0) {
      console.log("Seeding styles...");
      await client.mutation("functions/seed:seedStyles", {});
      console.log("✅ Styles seeded");
    }
    
    // Test 4: Get styles again
    const stylesAfter = await client.query("functions/styles:getPublicStyles", {});
    console.log("✅ Styles after seed:", stylesAfter.length, "found");
    console.log("Style names:", stylesAfter.map(s => s.name).join(", "));
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testConvex();
