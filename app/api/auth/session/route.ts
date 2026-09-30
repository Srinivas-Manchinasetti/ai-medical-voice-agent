import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/rbac';

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext(request);
    if (!auth || auth.userId === "unauthenticated") {
      return NextResponse.json({ isSignedIn: false, user: null, role: "patient" });
    }
    return NextResponse.json({
      isSignedIn: true,
      user: {
        id: auth.userId,
        name: auth.name,
        email: auth.email,
        role: auth.role,
      },
      role: auth.role,
    });
  } catch (error) {
    return NextResponse.json({ isSignedIn: false, user: null, role: "patient" });
  }
}

