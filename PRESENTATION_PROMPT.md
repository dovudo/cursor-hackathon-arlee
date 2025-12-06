# Presentation Prompt for Arlee AI MVP

**Task**: Create a professional presentation for the Cursor Hackathon (Chiang Mai) about the Arlee AI MVP project.

---

## Project Context

**Name**: Arlee AI

**Essence**: An AI director that automatically creates storyboards with images and audio from text scripts. Users input a text script, choose a style, and the system generates a complete storyboard with visual scenes and voiceover.

---

## The Problem (CRITICALLY IMPORTANT!)

**Main Problem**: Small and Medium Businesses (SMB) cannot effectively grow their social media presence due to lack of resources.

**Problem Details**:
- SMBs don't have budgets for professional videographers, designers, and scriptwriters
- Creating quality video content requires significant time and skills
- Social media requires constant content, but businesses lack resources to produce it
- Without quality content, businesses lose potential customers and growth opportunities
- Traditional video creation tools are too complex and expensive for small businesses

**Result**: SMB social media remains underdeveloped, businesses lose customers and growth opportunities.

---

## The Solution (KEY VALUE PROPOSITION!)

**Arlee AI** enables small and medium businesses to easily generate unlimited videos for social media from a single simple idea.

**How it works**:
1. Business comes up with one simple idea or topic
2. Enters the script text into the system
3. Chooses a style (Cinematic, Documentary, Minimalist)
4. System automatically generates a complete storyboard with images and audio
5. From one idea, multiple content variations can be created

**Key Value**:
- ✅ **Accessibility**: No professional skills or large budgets required
- ✅ **Speed**: Content generation in minutes instead of days
- ✅ **Scalability**: One idea → unlimited videos
- ✅ **Simplicity**: Just enter text → get ready-made content
- ✅ **Cost Savings**: No need to hire a team of designers and videographers

**Result**: SMBs can actively grow their social media, attract customers, and scale without major content investment.

---

## Use Case Examples (MUST INCLUDE!)

### Educational Content
- **"How does TCP/IP protocol work?"** - explaining technical concepts for IT companies
- **"History of the internet"** - educational videos for tech startups
- **"How does blockchain work?"** - complex topics explained simply

### Historical Content
- **"History of dumplings"** - for restaurants and cafes, stories about dishes
- **"History of a city"** - for travel agencies and local businesses
- **"History of a great person"** - biographies for educational channels
- **"Brand history"** - for companies telling their origin story

### Business Content
- **"How does our product work?"** - explaining products and services
- **"Our company's history"** - corporate stories for branding
- **"Usage tips"** - educational materials for customers
- **"Customer testimonials"** - visualizing success stories

### Entertainment Content
- **"Interesting facts about..."** - entertaining content to attract audience
- **"Myths and legends"** - cultural content for various niches
- **"How it's made?"** - behind-the-scenes content

**Important**: Show that from one topic you can create multiple variations - different styles, different accents, different formats.

---

## Tech Stack

**Backend**: Convex (sponsor)
- Reactive database with automatic real-time
- TypeScript-first development with auto-generated types
- Built-in File Storage for images and audio
- Serverless functions (Queries, Mutations, Actions)

**Frontend**: Next.js 15
- App Router for modern navigation
- React Context for simple state management
- Tailwind CSS for rapid styling
- Automatic real-time through Convex hooks

**AI Providers**:
- **OpenRouter** (Gemini 1.5 Flash) - storyboard generation from text
- **Replicate** (FLUX Pro) - high-quality image generation
- **ElevenLabs** (direct, no proxy) - professional voiceover generation

---

## Key Features

1. **Direct ElevenLabs integration** - no proxy, maximum performance
2. **Automatic real-time** - UI updates instantly without polling
3. **Simple flow** - text → style → ready storyboard in minutes
4. **Type safety** - Convex generates types automatically
5. **Rapid development** - MVP built in 6-7 hours thanks to Convex

---

## User Flow

1. **Script input**: User enters text script (e.g., "History of dumplings")
2. **Style selection**: Chooses style (Cinematic, Documentary, Minimalist)
3. **Storyboard generation**: AI breaks script into scenes with image prompts
4. **Parallel generation**: 
   - Images generated via Replicate FLUX
   - Audio generated via ElevenLabs
5. **Real-time results**: Storyboard displays in real-time as generation progresses
6. **Export and use**: Ready content can be used in social media

---

## Sponsor Products Usage

### Convex
- **Backend-as-a-Service** with automatic real-time
- **TypeScript-first** development accelerated development by 40%
- **Built-in file storage** simplified architecture
- **Automatic reactivity** - UI updates without additional code

### ElevenLabs
- **Direct TTS API integration** - high-quality voiceover
- **Multilingual support** - Russian and other languages
- **Fast generation** - audio ready in seconds
- **Professional quality** - sounds like a real narrator

---

## Architectural Decisions

- **Bottom-up strategy**: data first, then logic, then UI
- **Minimal DB schema**: 5 tables instead of 15+ for simplicity
- **React Context** instead of Redux for rapid development
- **Direct API calls** without unnecessary abstractions

---

## Metrics and Results

- **MVP development time**: 6-7 hours
- **Storyboard generation time**: 2-3 minutes
- **Database tables**: 5 (minimal schema)
- **Convex functions**: 8 (3 queries, 3 mutations, 3 actions)
- **Real-time updates**: automatic through Convex
- **Potential SMB savings**: thousands of dollars on content team

---

## Future Development

- **Video format export** - direct creation of ready videos
- **More styles and customization** - adaptation for different niches
- **Template system** - ready scripts for popular topics
- **Social media integration** - direct posting to Instagram, TikTok, YouTube
- **A/B testing** - automatic creation of content variations
- **Analytics** - tracking content effectiveness

---

## Presentation Structure

1. **Title slide**: Project name, team, hackathon, sponsor logos
2. **Problem**: Why SMB cannot grow social media (emphasis on lack of resources)
3. **Solution**: Arlee AI - how one idea becomes unlimited videos
4. **Use case examples**: Specific examples ("How does TCP/IP work?", "History of dumplings", "History of a city", "History of a great person")
5. **Demo**: Screenshots/video of the system in action
6. **Technologies**: Stack and why chosen (especially Convex and ElevenLabs)
7. **Sponsor products usage**: Details about Convex and ElevenLabs
8. **Architecture**: System diagram (simple diagram)
9. **User Flow**: Step-by-step process from idea to ready content
10. **Key features**: What makes the project stand out
11. **Results**: Metrics and achievements
12. **Future**: Development and scaling plans
13. **Conclusion**: Call to action - how this helps SMB grow

---

## Tone and Style

- **Professional but friendly** - clear for business audience
- **Emphasis on accessibility** - highlight this is for small business
- **Visual**: Modern design, interface screenshots, diagrams
- **Technically accurate but clear** - explain complex simply
- **Highlight sponsor product usage** - Convex and ElevenLabs
- **Emotional connection** - show real problems of real people

---

## Additional Requirements

- Presentation in **English**
- **12-15 slides** (including examples)
- Include **interface screenshots** (if available)
- **Architecture diagrams** and user flow
- **Sponsor logos** (Convex, ElevenLabs)
- **Call-to-action** at the end
- **Example visualization** - show how one topic becomes multiple videos

---

## Key Messages for Each Slide

1. **Problem**: "Small businesses cannot grow social media due to lack of resources"
2. **Solution**: "One idea → unlimited videos in minutes"
3. **Examples**: Show specific use case examples
4. **Technologies**: "Convex + ElevenLabs = rapid development + quality content"
5. **Value**: "Accessibility, speed, scalability for small business"

---

**Use this prompt to generate a presentation in any tool (PowerPoint, Google Slides, Canva, or AI presentation generator).**

**IMPORTANT**: Must include all use case examples and emphasize the key value for small and medium businesses!



