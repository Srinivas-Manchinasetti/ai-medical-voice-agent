import { NextResponse } from "next/server";
import { INDIAN_HOSPITALS_DATASET, calculateDistanceKm, Hospital } from "@/lib/hospitals-india-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userLat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : null;
    const userLng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : null;
    const specialtyFilter = searchParams.get("specialty")?.toLowerCase().trim() || "";
    const searchFilter = searchParams.get("query")?.toLowerCase().trim() || "";
    const cityFilter = searchParams.get("city")?.toLowerCase().trim() || "";
    const urgencyLevel = searchParams.get("urgency")?.toLowerCase().trim() || "emergency";

    let hospitals = [...INDIAN_HOSPITALS_DATASET];

    // Determine location context basis
    const hasGps = userLat !== null && !isNaN(userLat) && userLng !== null && !isNaN(userLng);
    const hasCitySearch = Boolean(cityFilter || searchFilter);

    const locationContext = hasGps
      ? { type: "gps", label: "Live GPS Location" }
      : hasCitySearch
      ? { type: "city", label: `City Center (${cityFilter || searchFilter})` }
      : { type: "none", label: "No Location Selected" };

    // Default reference coords if user GPS or search is not available
    const refLat = hasGps ? userLat! : 16.3067;
    const refLng = hasGps ? userLng! : 80.4365;

    // STEP 1: HARD CONSTRAINTS & ELIGIBILITY EVALUATION
    const processedHospitals = hospitals.map((h) => {
      const dist = calculateDistanceKm(refLat, refLng, h.latitude, h.longitude);
      
      // Calculate estimated ambulance/travel time in minutes (urban speed ~35 km/h)
      const etaMinutes = Math.max(4, Math.round((dist / 35) * 60));

      // Hard eligibility evaluation
      let isEligible = true;
      const matchReasons: string[] = [];

      // Check 24/7 ER constraint for Emergency cases
      if (urgencyLevel === "emergency" && !h.isEmergency24x7) {
        isEligible = false;
      } else if (h.isEmergency24x7) {
        matchReasons.push("24/7 Level-1 Emergency Department");
      }

      // Check Specialty capability match
      if (specialtyFilter && specialtyFilter !== "all") {
        const matchesSpecialty = h.specialty.some((s) => s.toLowerCase().includes(specialtyFilter)) ||
          (specialtyFilter.includes("cancer") && h.cancerSpecialistsAvailable);
        
        if (!matchesSpecialty) {
          isEligible = false;
        } else {
          matchReasons.push(`On-call ${specialtyFilter.charAt(0).toUpperCase() + specialtyFilter.slice(1)} Specialists`);
        }
      }

      // Check City/Search Query filter if specified
      if (searchFilter || cityFilter) {
        const term = searchFilter || cityFilter;
        const matchesSearch = h.name.toLowerCase().includes(term) ||
          h.city.toLowerCase().includes(term) ||
          h.state.toLowerCase().includes(term) ||
          h.address.toLowerCase().includes(term) ||
          h.specialty.some((s) => s.toLowerCase().includes(term));

        if (!matchesSearch) {
          isEligible = false;
        }
      }

      // Travel time match reason (only if location is active)
      if (locationContext.type !== "none" && dist <= 15) {
        matchReasons.push(`Shortest estimated travel time (${etaMinutes} min)`);
      }

      // Quality & Accreditation match reason
      if (h.accreditation && h.accreditation.length > 0) {
        matchReasons.push(`${h.accreditation.join(" & ")} Accredited`);
      }

      return {
        ...h,
        distanceKm: locationContext.type !== "none" ? dist : null,
        etaMinutes: locationContext.type !== "none" ? etaMinutes : null,
        hasDistanceContext: locationContext.type !== "none",
        distanceSource: locationContext.type,
        isEligible,
        matchReasons,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${h.name}, ${h.address}`
        )}`,
      };
    });

    // STEP 2: SOFT RANKING (Eligible facilities first)
    const eligibleFacilities = processedHospitals.filter((h) => h.isEligible);
    const nonEligibleFacilities = processedHospitals.filter((h) => !h.isEligible);

    // Sort strictly by ETA in minutes / Distance if location context exists
    if (locationContext.type !== "none") {
      eligibleFacilities.sort((a, b) => (a.etaMinutes ?? 999) - (b.etaMinutes ?? 999));
      nonEligibleFacilities.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }

    const sortedHospitals = [...eligibleFacilities, ...nonEligibleFacilities].map((h, idx) => ({
      ...h,
      matchLabel: idx === 0 && h.isEligible && locationContext.type !== "none" ? "BEST MATCH" : h.isEligible ? "RECOMMENDED CARE" : "FACILITY DIRECTORY",
    }));

    return NextResponse.json({
      status: "success",
      count: sortedHospitals.length,
      eligibleCount: eligibleFacilities.length,
      locationContext,
      userLocationDetected: hasGps,
      userCoordinates: hasGps ? { lat: userLat, lng: userLng } : null,
      hospitals: sortedHospitals,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed to fetch hospital care routing data" },
      { status: 500 }
    );
  }
}

