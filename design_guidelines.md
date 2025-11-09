# Hourglass Crypto Platform Design Guidelines

## Design Approach
**Reference-Based: Institutional Fintech/Crypto Aesthetic**
Primary inspiration: Hourglass (provided screenshots), with influences from Coinbase, Stripe, and Linear for clean, professional crypto interfaces.

**Core Principles:**
- Premium institutional feel with minimal complexity
- Trust and credibility through clean design
- Focus on clarity over decorative elements
- Sophisticated without being cold

## Typography Hierarchy

**Font Selection:**
- Primary: Inter or Space Grotesk (modern, geometric sans-serif)
- Display: Large, bold weights (700-800) for headlines
- Body: Regular (400) and Medium (500) weights

**Type Scale:**
- Hero headline: 4xl-6xl, bold, tight line-height (1.1)
- Section headlines: 3xl-4xl, bold
- Subheadlines: xl-2xl, medium weight
- Body text: base-lg, regular
- UI elements/labels: sm-base, medium weight
- Captions: xs-sm, regular

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 8, 12, 16, 20, 24, 32
- Component internal padding: p-4 to p-8
- Section vertical spacing: py-20 to py-32
- Grid gaps: gap-4 to gap-8
- Button padding: px-6 py-3 to px-8 py-4

**Container Strategy:**
- Max-width: max-w-7xl with horizontal padding
- Full-bleed sections for visual impact
- Asymmetric layouts where appropriate

## Page Structure

### Header/Navigation
- Fixed or sticky header with minimal height
- Logo left, navigation center/right
- Connect Wallet button (primary CTA) in header
- Social links (X/Twitter, Discord, Docs) - icon-only or minimal text
- Transparent background with subtle blur effect

### Hero Section
- Full viewport height (min-h-screen) with vertical centering
- Two-column layout: content left (60%), visual right (40%)
- Large gradient headline text spanning multiple lines
- Concise subheadline emphasizing institutional yield
- Primary CTA button below headline
- Animated mockup/interface visual on right showing platform UI
- Large watermark text in background for depth

### Early Access Program Section
- Centered content with morphic card design
- Visual flow diagram showing deposit process (Stable → iUSDT)
- Green-tinted glass-morphism effect on cards
- Connection arrows between elements
- Clear labeling (MAINNET, CLAIM indicators)

### Process Steps Section
- Four-column grid on desktop (01-04 numbered steps)
- Each step: Large number, title, description
- Vertical stack on mobile
- Steps: Deposit → KYC → Yield → Withdraw
- Generous spacing between columns (gap-8 to gap-12)

### Investor/Trust Section
- Horizontal logo grid showcasing backers
- Logos: Electric Capital, Coinbase Ventures, Tribe Capital
- Grayscale or monochrome logos for consistency
- Even spacing with subtle dividers

### Footer
- Large "Hourglass" text watermark spanning width
- Tagline: "Institutional yield for stablecoins"
- Minimal footer links if needed
- Social icon links repeated

## Component Library

### Buttons
**Primary (Connect Wallet):**
- Rounded corners (rounded-lg to rounded-xl)
- Medium-large size (px-6 py-3 to px-8 py-4)
- Bold text (font-medium to font-semibold)
- When over images: backdrop-blur with semi-transparent background

**Style Variations:**
- Solid fill for primary actions
- Outline/border for secondary actions
- Consistent hover states with subtle scale/shadow

### Cards
- Glass-morphism effect with backdrop blur
- Subtle borders or shadows
- Rounded corners (rounded-2xl to rounded-3xl)
- Internal padding: p-6 to p-8
- Use for platform mockups and process displays

### Typography Effects
- Gradient text for key headlines (using background-clip technique)
- Large watermark text with low opacity for layering
- Tight tracking on display type

### Status Indicators
- Small badges/pills for labels (MAINNET, CLAIM)
- Rounded-full style
- Compact padding (px-3 py-1)

## Images

**Hero Mockup (Right Side):**
Image showing platform dashboard/interface with deposit status, balances, and yield information. Should appear as an animated browser window or device mockup showcasing the actual platform UI. Place in hero section occupying 40% width on desktop.

**Background Elements:**
Subtle gradient mesh or geometric patterns can be used sparingly for depth without distraction.

## Animations

**Use Sparingly:**
- Hero mockup: gentle float or subtle parallax
- Gradient text: optional slow shimmer effect
- Scroll reveals: fade-up for sections
- Button hovers: scale and glow effects
- NO complex scroll-triggered animations

## Accessibility

- Maintain WCAG AA contrast ratios
- Focus states visible on all interactive elements
- Semantic HTML structure
- Keyboard navigation support
- Clear hierarchy for screen readers

## Responsive Behavior

**Desktop (lg+):**
- Multi-column layouts as specified
- Full hero visuals displayed
- Horizontal navigation

**Tablet (md):**
- Two-column where appropriate
- Reduce hero visual size
- Maintain readability

**Mobile (base):**
- Single column stack
- Hero content centered, visual below or hidden
- Hamburger navigation if needed
- Maintain CTA prominence
- Process steps stack vertically with full descriptions