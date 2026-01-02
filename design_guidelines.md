# Uniswap-Style DEX Swap Interface Design Guidelines

## Design Approach
**Reference-Based: Modern DeFi/DEX Aesthetic**
Primary inspiration: Uniswap V3, with influences from 1inch, Pancakeswap, and Curve for clean, professional decentralized exchange interfaces.

**Core Principles:**
- Clarity and speed for trading actions
- Minimal friction between user and transaction
- Professional without unnecessary decoration
- Trust through simplicity and transparency

## Typography Hierarchy

**Font Selection:**
- Primary: Inter (400, 500, 600, 700 weights via Google Fonts)

**Type Scale:**
- Navigation/Tabs: base, font-medium (500)
- Card headers: lg-xl, font-semibold (600)
- Token amounts: 2xl-4xl, font-bold (700) for large input displays
- Labels: sm, font-medium (500)
- Helper text: xs-sm, font-normal (400)
- Button text: base, font-semibold (600)

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Component padding: p-4 to p-6
- Card internal spacing: p-6 to p-8
- Grid gaps: gap-4 to gap-6
- Button padding: px-6 py-3

**Container Strategy:**
- Centered swap card: max-w-md (448px)
- Page container: max-w-7xl with px-4 to px-6
- Full viewport height for swap interface area

## Page Structure

### Header Navigation
- Horizontal nav bar with subtle border-bottom
- Logo left (Uniswap icon + wordmark style)
- Center: Tab navigation (Trade, Explore, Pool, Portfolio) with active tab indicator
- Right side: Search bar (rounded-full, compact) + Connect Wallet button
- Height: h-16 to h-20
- Sticky positioning (sticky top-0)

### Main Swap Interface
- Centered vertically and horizontally (min-h-screen flex setup)
- Single card component (rounded-3xl, shadow-lg)
- Card width: max-w-md
- Internal padding: p-6

### Swap Card Components

**Token Input Sections (2 sections stacked):**
- Each section: rounded-2xl with border, p-4
- Top row: "You pay" / "You receive" label (text-sm)
- Large input field: text-4xl, right-aligned for amount
- Bottom row: Token selector button (left) + Balance display (right, text-sm)
- Vertical spacing between sections: gap-2 (tight connection)

**Swap Direction Button:**
- Circular button between input sections
- Positioned at overlap point (absolute positioning)
- Icon: Arrows pointing up/down
- Size: w-10 h-10
- Elevated with shadow

**Action Button:**
- Full-width at card bottom (w-full)
- Large size: py-4
- States: "Connect Wallet" → "Enter amount" → "Swap" → "Insufficient balance"
- Rounded-2xl

**Transaction Details:**
- Expandable section below inputs (accordion pattern)
- Shows: Rate, Price impact, Min received, Network fee
- Text-sm with label-value pairs
- Subtle dividers between rows

## Component Library

### Buttons
**Primary (Connect Wallet, Swap):**
- Rounded-2xl corners
- px-6 py-4 padding
- font-semibold text
- Full width for action buttons

**Token Selector:**
- Rounded-full or rounded-xl
- Token icon (20-24px) + Symbol + Dropdown arrow
- px-4 py-2 padding
- Border on hover states

**Tab Navigation:**
- px-4 py-2 each tab
- Underline indicator (h-0.5) for active state
- Medium font-weight

### Cards
- Main swap card: rounded-3xl, p-6, shadow-xl
- Token input containers: rounded-2xl, border, p-4
- Subtle elevation differences for layering

### Input Fields
- Borderless for amount inputs (focus on typography)
- Large text size (2xl-4xl) for visibility
- Placeholder text in lighter weight
- Number formatting with commas

### Token Icons
- Circular containers: w-8 h-8 to w-10 h-10
- Use common token logos (ETH, USDC, DAI, WBTC etc.)
- Fallback to generic icon for unknown tokens

### Modals
**Token Selection Modal:**
- Full-screen overlay on mobile, centered on desktop
- Search input at top (sticky)
- Scrollable token list with icons, symbols, names, balances
- Popular tokens section at top
- List items: flex layout, p-3, hover states

## Accessibility
- High contrast text throughout
- Focus indicators on all interactive elements
- Keyboard navigation for token selection
- Clear labels for screen readers
- ARIA labels for swap direction button

## Responsive Behavior

**Desktop (lg+):**
- Centered swap card at max-w-md
- Full horizontal navigation
- Ample whitespace around card

**Tablet (md):**
- Same card width
- Maintain desktop layout
- Adjust header spacing

**Mobile (base):**
- Full-width card (mx-4)
- Hamburger menu for navigation tabs
- Search bar collapses/relocates
- Larger touch targets (min 44px)
- Token selector buttons stack if needed

## Visual Enhancements

**Gradients:**
- Subtle gradient on primary button (pink to lighter pink)
- Optional gradient mesh background (very subtle)

**Shadows:**
- Elevated card: shadow-xl
- Floating swap button: shadow-lg
- Input focus: subtle glow effect

**Icons:**
- Use Heroicons for UI elements (arrows, search, menu, external links)
- Token logos from common libraries or CDN

**Animations:**
- Swap direction button: 180deg rotation on click
- Card hover: subtle lift (scale-101)
- Button press: slight scale-down (scale-98)
- Price updates: gentle flash/highlight
- NO complex scroll animations

## Images
No large hero images required. This is a utility-focused application interface. Background can use subtle gradient mesh or remain solid with minimal decoration. Focus is entirely on the functional swap card component.