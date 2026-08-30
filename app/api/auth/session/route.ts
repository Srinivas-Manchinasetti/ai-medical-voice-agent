import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ isSignedIn: false, user: null });
    }
    return NextResponse.json({
      isSignedIn: true,
      user: {
        id: user.id,
        name:
          user.fullName ||
          (user.firstName ? (user.firstName + (user.lastName ? ' ' + user.lastName : '')) : '') ||
          user.username ||
          'Physician',
        firstName: user.firstName || 'Physician',
        email:
          user.primaryEmailAddress?.emailAddress ||
          user.emailAddresses?.[0]?.emailAddress ||
          '',
        imageUrl: user.imageUrl || '',
      },
    });
  } catch (error) {
    return NextResponse.json({ isSignedIn: false, user: null });
  }
}
