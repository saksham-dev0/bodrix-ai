# Bodrix - Convex + Clerk Authentication Setup

This project demonstrates a complete authentication setup using Convex and Clerk.

## Features

- ✅ Clerk authentication integration
- ✅ Convex database with user management
- ✅ Automatic user synchronization
- ✅ Real-time user data updates
- ✅ Webhook support for user events

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# Convex Configuration
NEXT_PUBLIC_CONVEX_URL=your_convex_url
CONVEX_DEPLOYMENT=your_convex_deployment_name
CLERK_JWT_ISSUER_DOMAIN=your_clerk_jwt_issuer_domain
```

### 2. Clerk Dashboard Setup

1. Go to your Clerk Dashboard
2. Navigate to "JWT Templates"
3. Create a new template named "convex"
4. Copy the issuer domain and add it to your environment variables
5. Set up webhooks pointing to `https://your-domain.com/api/convex/clerk-webhook`

### 3. Convex Dashboard Setup

1. Go to your Convex Dashboard
2. Navigate to "Settings" > "Environment Variables"
3. Add `CLERK_JWT_ISSUER_DOMAIN` with your Clerk issuer domain

### 4. Running the Application

```bash
# Install dependencies
npm install

# Start Convex development server
npx convex dev

# In another terminal, start Next.js
npm run dev
```

## Database Schema

The application includes a `users` table with the following structure:

```typescript
{
  clerkId: string,        // Clerk user ID
  name: string,          // Full name
  email: string,         // Email address
  imageUrl?: string,     // Profile image URL
  firstName?: string,    // First name
  lastName?: string,     // Last name
  createdAt: number,    // Creation timestamp
  updatedAt: number,     // Last update timestamp
}
```

## API Functions

### Public Functions

- `getCurrentUser()` - Get the current authenticated user
- `createOrUpdateUser()` - Create or update user data
- `getUserByClerkId()` - Get user by Clerk ID

### Internal Functions

- `internalCreateOrUpdateUser()` - Internal user creation/update (for webhooks)
- `internalDeleteUser()` - Internal user deletion (for webhooks)

## Webhook Endpoints

- `POST /api/convex/clerk-webhook` - Handles Clerk user events

## How It Works

1. User signs up/signs in through Clerk
2. UserSync component automatically syncs user data to Convex
3. Webhook handles user updates/deletions from Clerk
4. Frontend displays user information from both Clerk and Convex

## Testing

1. Start the development servers
2. Navigate to `http://localhost:3000`
3. Click "Sign In" to authenticate with Clerk
4. Verify that user data appears in both Clerk and Convex database
5. Check the Convex dashboard to see the user record
