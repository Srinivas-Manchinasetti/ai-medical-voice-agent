"use client";

import React, { useRef, useState, useEffect, type CSSProperties } from "react";
import { useUser, useClerk } from "@clerk/nextjs";

export type LandingPageFrameProps = {
  className?: string;
  sourceUrl: string;
  srcDoc?: string;
  style?: CSSProperties;
  title: string;
};

export function LandingPageFrame({
  className = "",
  sourceUrl,
  srcDoc,
  style,
  title,
}: LandingPageFrameProps) {
  const [ready, setReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { isSignedIn, user, isLoaded } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    const doSync = () => {
      try {
        const iframe = frameRef.current;
        if (!iframe || !iframe.contentWindow) return;
        const authPayload = {
          type: "MEDVOICE_AUTH_STATE",
          isLoaded,
          isSignedIn: Boolean(isSignedIn),
          user:
            isSignedIn && user
              ? {
                  id: user.id,
                  name:
                    user.fullName ||
                    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                    user.username ||
                    "Physician",
                  firstName: user.firstName || "Physician",
                  email:
                    user.primaryEmailAddress?.emailAddress ||
                    user.emailAddresses?.[0]?.emailAddress ||
                    "",
                  imageUrl: user.imageUrl || "",
                }
              : null,
        };

        // 1. PostMessage
        iframe.contentWindow.postMessage(authPayload, "*");

        // 2. Direct same-origin window call
        const win = iframe.contentWindow as any;
        if (win && typeof win.updateAuthStateUI === "function") {
          win.updateAuthStateUI(authPayload);
        }

        // 3. Direct document DOM update
        const doc = iframe.contentDocument || win?.document;
        if (doc) {
          const navAuthBtn = doc.getElementById("nav-auth-btn");
          const signedOutView = doc.getElementById("auth-signed-out-view");
          const signedInView = doc.getElementById("auth-signed-in-view");
          const userNameEl = doc.getElementById("auth-user-name");
          const userEmailEl = doc.getElementById("auth-user-email");
          const userAvatarEl = doc.getElementById("auth-user-avatar");

          if (authPayload.isSignedIn && authPayload.user) {
            const uName = authPayload.user.name;
            const uInitials =
              uName
                .split(" ")
                .map((n: string) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase() || "ME";

            // If name has 2 parts like 'Pujala Puneeth', display calling name or full clean name
            const displayName = uName.trim();

            if (navAuthBtn) {
              navAuthBtn.innerHTML = `
                <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981;"></span>
                <span style="font-size:12px; font-weight:600; text-transform:none; letter-spacing:0.01em; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${displayName}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 9l-7 7-7-7"/></svg>
              `;
              navAuthBtn.href = "#";
              navAuthBtn.title = `Signed in as ${uName}`;
              navAuthBtn.onclick = (e: any) => {
                e.preventDefault();
                const burger =
                  doc.getElementById("nav-burger-btn") ||
                  doc.querySelector(".nav-burger");
                if (burger) (burger as HTMLElement).click();
              };
            }

            if (signedOutView) signedOutView.style.display = "none";
            if (signedInView) signedInView.style.display = "block";
            if (userNameEl) userNameEl.textContent = uName;
            if (userEmailEl)
              userEmailEl.textContent =
                authPayload.user.email || "Verified Clinical Session";
            if (userAvatarEl) {
              if (authPayload.user.imageUrl) {
                userAvatarEl.innerHTML = `<img src="${authPayload.user.imageUrl}" alt="${uName}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
              } else {
                userAvatarEl.textContent = uInitials;
              }
            }
          } else if (isLoaded && !isSignedIn) {
            if (navAuthBtn) {
              navAuthBtn.innerHTML = `
                <span>Sign In</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
              `;
              navAuthBtn.href = "/sign-in";
              navAuthBtn.onclick = null;
            }
            if (signedOutView) signedOutView.style.display = "block";
            if (signedInView) signedInView.style.display = "none";
          }
        }
      } catch (err) {
        // safe ignore
      }
    };

    doSync();
    const t1 = setTimeout(doSync, 50);
    const t2 = setTimeout(doSync, 200);
    const t3 = setTimeout(doSync, 500);
    const t4 = setTimeout(doSync, 1000);
    const t5 = setTimeout(doSync, 2000);
    const interval = setInterval(doSync, 1000);

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "MEDVOICE_REQUEST_AUTH_STATE") {
        doSync();
      } else if (e.data?.type === "MEDVOICE_SIGN_OUT") {
        signOut({ redirectUrl: "/" });
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearInterval(interval);
      window.removeEventListener("message", handleMessage);
    };
  }, [isLoaded, isSignedIn, user, signOut]);

  return (
    <div
      className={`relative w-full min-h-screen h-screen overflow-hidden bg-[#05070a] ${className}`}
      style={style}
    >
      <iframe
        ref={frameRef}
        title={title}
        {...(srcDoc ? { srcDoc } : { src: sourceUrl })}
        loading="eager"
        onLoad={() => {
          setReady(true);
        }}
        className="w-full h-full border-0 block"
        style={{
          width: "100%",
          height: "100%",
          border: 0,
          background: "#05070a",
          opacity: ready ? 1 : 0.9,
          transition: "opacity 0.4s ease",
        }}
      />
    </div>
  );
}

export function KageLandingPage() {
  return (
    <LandingPageFrame
      title="Kage — Where stillness reveals the unseen"
      sourceUrl="/landing-pages/kage.html"
    />
  );
}
