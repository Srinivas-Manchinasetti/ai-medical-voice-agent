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
      ? { type: "gps", label: "Live Location" }
      : hasCitySearch
      ? { type: "city", label: `City Center (${cityFilter || searchFilter})` }
      : { type: "none", label: "Default Region" };

    // Default reference coords if user GPS or search is not available (Guntur / AP default)
    const refLat = hasGps ? userLat! : 16.3067;
    const refLng = hasGps ? userLng! : 80.4365;

    // STEP 1: HARD CONSTRAINTS & ELIGIBILITY EVALUATION
    const processedHospitals = hospitals.map((h) => {
      const dist = calculateDistanceKm(refLat, refLng, h.latitude, h.longitude);
      
      // Calculate estimated ambulance/travel time in minutes (urban speed ~32 km/h)
      const etaMinutes = Math.max(3, Math.round((dist / 32) * 60));

      // Hard eligibility evaluation
      let isEligible = true;
      const matchReasons: string[] = [];

      // Check 24/7 ER constraint for Emergency cases
      if (urgencyLevel === "emergency" && !h.isEmergency24x7) {
        isEligible = false;
      } else if (h.isEmergency24x7) {
        matchReasons.push("24/7 Emergency Department");
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

      // Travel time match reason
      if (dist <= 25) {
        matchReasons.push(`Estimated drive time: ~${etaMinutes} mins`);
      }

      // Quality & Accreditation match reason
      if (h.accreditation && h.accreditation.length > 0) {
        matchReasons.push(`${h.accreditation.join(" & ")} Accredited`);
      }

      return {
        id: h.id,
        name: h.name,
        specialty: h.specialty,
        city: h.city,
        state: h.state,
        address: h.address,
        phone: h.phone,
        emergencyPhone: h.emergencyPhone,
        latitude: h.latitude,
        longitude: h.longitude,
        isEmergency24x7: h.isEmergency24x7,
        rating: h.rating,
        accreditation: h.accreditation,
        cancerSpecialistsAvailable: h.cancerSpecialistsAvailable,
        distanceKm: dist,
        etaMinutes: etaMinutes,
        hasDistanceContext: true,
        distanceSource: locationContext.type,
        isEligible,
        matchReasons,
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${refLat},${refLng}&destination=${encodeURIComponent(
          `${h.name}, ${h.address}`
        )}`,
      };
    });

    // STEP 2: RANKING (Sort by closest distance / drive time first)
    const eligibleFacilities = processedHospitals.filter((h) => h.isEligible);
    const nonEligibleFacilities = processedHospitals.filter((h) => !h.isEligible);

    eligibleFacilities.sort((a, b) => a.distanceKm - b.distanceKm);
    nonEligibleFacilities.sort((a, b) => a.distanceKm - b.distanceKm);

    const sortedHospitals = [...eligibleFacilities, ...nonEligibleFacilities].map((h, idx) => ({
      ...h,
      matchLabel: idx === 0 && h.isEligible ? "CLOSEST ER" : h.isEligible ? "EMERGENCY CARE" : "FACILITY DIRECTORY",
    }));

    return NextResponse.json({
      status: "success",
      count: sortedHospitals.length,
      eligibleCount: eligibleFacilities.length,
      locationContext,
      userLocationDetected: hasGps,
      userCoordinates: { lat: refLat, lng: refLng },
      hospitals: sortedHospitals,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed to fetch hospital care routing data" },
      { status: 500 }
    );
  }
}
