# Design Guidelines: Passport Management System

## Design Approach

**Selected Approach:** Design System - Minimal Admin Interface
**Primary Inspiration:** Linear, Vercel Dashboard, Notion
**Rationale:** Data-heavy administrative system requiring clarity, efficiency, and long-term stability. The minimalistic, light aesthetic requested aligns with modern productivity tools that prioritize information hierarchy over visual decoration.

---

## Core Design Principles

1. **Information Clarity First** - Every element serves a functional purpose
2. **Generous Whitespace** - Light, breathable layouts reduce cognitive load
3. **Consistent Patterns** - Predictable interactions across all admin functions
4. **Status-Driven Design** - Visual indicators (active/inactive) must be immediately obvious

---

## Typography System

**Font Stack:** Inter (via Google Fonts CDN) - single family for simplicity

**Hierarchy:**
- Page Titles: text-3xl, font-semibold (36px)
- Section Headers: text-xl, font-semibold (20px)
- Card/Component Titles: text-base, font-medium (16px)
- Body Text: text-sm, font-normal (14px)
- Labels/Meta: text-xs, font-medium, uppercase tracking (12px)
- Table Data: text-sm, font-normal (14px)

**Russian Language Considerations:** Ensure proper Cyrillic character support and slightly increased line-height (1.6) for readability

---

## Layout & Spacing System

**Spacing Primitives:** Use Tailwind units: **2, 4, 8, 12, 16** (gap-4, p-8, mb-12, etc.)

**Container Strategy:**
- Admin Dashboard: Full-width with max-w-7xl centered container
- Forms/Modals: max-w-2xl for optimal readability
- Tables: Full-width within container with horizontal scroll on mobile

**Responsive Breakpoints:**
- Mobile: Single column, stacked cards
- Tablet (md): 2-column grids where appropriate
- Desktop (lg): Full multi-column layouts, side navigation

---

## Component Library

### Admin Dashboard Layout
- **Top Navigation Bar:** Fixed header with logo, admin name, logout - h-16
- **Sidebar Navigation:** Fixed left sidebar (w-64) with group list, dashboard link, settings - collapsible on mobile
- **Main Content Area:** Full-height with internal scrolling, p-8 padding

### Data Tables
- Minimal borders (border-b on rows only)
- Alternating row backgrounds for scannability (subtle stripe pattern)
- Sortable column headers with arrow indicators
- **Inactive Row Highlighting:** Entire row gets subtle treatment (not just text) for expired passports
- Sticky header on scroll
- Action buttons (edit/delete) appear on row hover (desktop) or always visible (mobile)

### Passport Cards (Grid View Alternative)
- Clean cards with subtle border, rounded corners (rounded-lg)
- Photo: Fixed aspect ratio circle or square (w-20 h-20)
- Status badge: Prominent placement top-right
- Hover state: Subtle shadow elevation
- Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8

### Forms
- Vertical stacking with generous spacing (space-y-8)
- Label above input: text-sm font-medium mb-2
- Input fields: Full-width, h-12, rounded-md, border
- File upload: Drag-and-drop zone with preview thumbnail
- Submit buttons: Right-aligned or full-width on mobile
- Validation: Inline error messages below fields

### Public Passport Page
- **Clean, Certificate-like Layout:** Centered max-w-2xl container
- **Header Section:** Person photo (large, w-32 h-32), full name prominent
- **Details Grid:** 2-column layout (label: value pairs) with clear hierarchy
- **Status Display:** Large, centered status indicator (Активен / Паспорт неактивен) with appropriate visual weight
- **QR Code:** Positioned bottom-right or center-bottom, medium size (w-40 h-40)
- **Minimalist Footer:** Subtle branding, no navigation

### Status Indicators
- **Active:** Checkmark icon, clear visual confirmation
- **Inactive/Expired:** X icon or alert icon, prominent treatment
- **Badge Style:** Inline badges with icon + text, rounded-full, px-3 py-1

### Modals/Dialogs
- Centered overlay with backdrop blur
- Max-width: max-w-lg for simple confirmations, max-w-2xl for forms
- Clear header with close button (X)
- Footer with action buttons (Cancel left, Primary action right)

### Groups Management
- Sidebar list with group names
- Active group highlighted
- Inline edit for group names (click to edit pattern)
- Drag-and-drop for moving people between groups (visual feedback during drag)

### Activity Log
- Timeline layout with connector line
- Each entry: timestamp, admin name, action description
- Most recent at top
- Compact text-sm sizing

---

## Navigation Structure

**Admin Dashboard:**
- Sidebar: "Все паспорта", Group sections, "Настройки", "Журнал изменений"
- Top bar: Quick actions (+ Создать паспорт), Search, Admin menu

**Mobile Navigation:**
- Hamburger menu revealing sidebar overlay
- Bottom navigation bar for primary actions

---

## Interactive Elements

**Buttons:**
- Primary: Solid, h-10, px-6, rounded-md, font-medium
- Secondary: Outline style, same sizing
- Danger: For delete actions
- Icon buttons: Square (h-10 w-10) for actions

**Hover States:**
- Subtle background transitions (200ms)
- No elaborate animations - focus on instant feedback

**Loading States:**
- Skeleton screens for table data
- Spinner for form submissions
- Optimistic UI updates where possible

---

## Accessibility

- All form inputs include labels (no placeholders as labels)
- Sufficient contrast ratios for all text
- Keyboard navigation support throughout
- Focus indicators on interactive elements (ring-2)
- ARIA labels for icon-only buttons
- Screen reader announcements for status changes

---

## Images

**Profile Photos:**
- Placeholder: Simple circular div with initials when no photo uploaded
- Uploaded: Display in circular or rounded-square format
- Consistent sizing: w-20 h-20 (list view), w-32 h-32 (detail view)
- Image optimization: Serve appropriately sized thumbnails

**No Hero Images:** This is an admin tool - no decorative heroes needed. Jump straight to functionality.

---

## Key Differentiators

1. **Extreme Clarity:** No visual noise - every pixel serves the user's task
2. **Status-First Design:** Active/inactive states are impossible to miss
3. **Efficient Workflows:** Minimal clicks to complete common tasks (create, edit, move between groups)
4. **Scannable Data:** Tables and cards designed for rapid information scanning
5. **Russian-First:** All UI text, labels, placeholders in Russian - proper Cyrillic typography