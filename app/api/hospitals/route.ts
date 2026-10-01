import { NextResponse } from "next/server";
import { INDIAN_HOSPITALS_DATASET, ALL_REGION_PRESETS, calculateDistanceKm, Hospital, getHospitalFamousFor } from "@/lib/hospitals-india-data";
import { discoverHospitalsNearCoordinates } from "@/lib/care-network/osm-discovery";

export function calculateRealisticDriveTime(distanceKm: number): number {
  if (distanceKm <= 4) {
    // Dense city traffic: ~18 km/h + signal buffer
    return Math.max(4, Math.round((distanceKm / 18) * 60));
  } else if (distanceKm <= 12) {
    // Mixed urban/arterial: ~25 km/h
    return Math.max(6, Math.round((distanceKm / 25) * 60));
  } else if (distanceKm <= 50) {
    // Suburban / ring road: ~45 km/h
    return Math.max(10, Math.round(13 + ((distanceKm - 4) / 45) * 60));
  } else {
    // Inter-city National Highway: ~65 km/h
    return Math.max(25, Math.round(30 + ((distanceKm - 15) / 65) * 60));
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLat = searchParams.get("lat");
    const rawLng = searchParams.get("lng");
    const userLat = rawLat !== null ? parseFloat(rawLat) : null;
    const userLng = rawLng !== null ? parseFloat(rawLng) : null;

    // Patient departure coordinates (where user is physically located)
    const patientLatParam = searchParams.get("patientLat") ? parseFloat(searchParams.get("patientLat")!) : null;
    const patientLngParam = searchParams.get("patientLng") ? parseFloat(searchParams.get("patientLng")!) : null;

    const specialtyFilter = searchParams.get("specialty")?.toLowerCase().trim() || "";
    const searchFilter = searchParams.get("query")?.toLowerCase().trim() || "";
    const cityFilter = searchParams.get("city")?.toLowerCase().trim() || "";
    const urgencyLevel = searchParams.get("urgency")?.toLowerCase().trim() || "all";

    const latProvided = rawLat !== null && rawLat.trim() !== "";
    const lngProvided = rawLng !== null && rawLng.trim() !== "";
    const hasCitySearch = Boolean(cityFilter || searchFilter);

    // Validate coordinates if provided
    if (latProvided || lngProvided) {
      if (
        userLat === null ||
        userLng === null ||
        !Number.isFinite(userLat) ||
        !Number.isFinite(userLng) ||
        userLat < -90 ||
        userLat > 90 ||
        userLng < -180 ||
        userLng > 180
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid coordinates provided: latitude must be between -90 and 90, longitude between -180 and 180.",
            hospitals: [],
          },
          { status: 400 }
        );
      }
    }

    // Require either explicit coordinates or explicit city search
    if (!latProvided && !lngProvided && !hasCitySearch) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required location: valid latitude and longitude coordinates or explicit city parameter are required.",
          hospitals: [],
        },
        { status: 400 }
      );
    }

    let refLat: number;
    let refLng: number;
    let locationContext: { type: "gps" | "city"; label: string };

    if (latProvided && lngProvided && userLat !== null && userLng !== null) {
      refLat = userLat;
      refLng = userLng;
      locationContext = { type: "gps", label: "Live Location" };
    } else {
      const q = (cityFilter || searchFilter).toLowerCase().trim();
      const matchedCity =
        ALL_REGION_PRESETS.find((p) => p.name.toLowerCase() === q || p.label.toLowerCase().includes(q)) ||
        INDIAN_HOSPITALS_DATASET.find(
          (h) => h.city.toLowerCase() === q || h.address.toLowerCase().includes(q)
        );

      if (matchedCity) {
        if ("lat" in matchedCity) {
          refLat = matchedCity.lat;
          refLng = matchedCity.lng;
          locationContext = {
            type: "city",
            label: `City Center (${matchedCity.name})`,
          };
        } else {
          refLat = (matchedCity as Hospital).latitude;
          refLng = (matchedCity as Hospital).longitude;
          locationContext = {
            type: "city",
            label: `City Center (${(matchedCity as Hospital).city})`,
          };
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: `Unknown city or region '${cityFilter || searchFilter}'. Please provide valid coordinates or an accredited city name.`,
            hospitals: [],
          },
          { status: 400 }
        );
      }
    }

    // True origin coords for calculating distance & driving time from where the patient is
    const hasPatientOrigin =
      patientLatParam !== null &&
      Number.isFinite(patientLatParam) &&
      patientLngParam !== null &&
      Number.isFinite(patientLngParam);
    const originLat = hasPatientOrigin ? patientLatParam! : refLat;
    const originLng = hasPatientOrigin ? patientLngParam! : refLng;

    // DYNAMIC POI DISCOVERY: Discover real local hospitals around any coordinate worldwide
    let localCandidates: Hospital[] = [];
    if (Number.isFinite(refLat) && Number.isFinite(refLng)) {
      try {
        const liveDiscovered = await discoverHospitalsNearCoordinates(refLat, refLng, 40);
        if (liveDiscovered && liveDiscovered.length > 0) {
          localCandidates = liveDiscovered;
        }
      } catch (err: any) {
        console.warn("[HospitalsAPI] Dynamic OSM discovery failed, using registry:", err.message);
      }
    }

    // Blend with any verified offline registry hospitals that are within reach (<= 65km)
    const nearbyRegistry = INDIAN_HOSPITALS_DATASET.filter((h) => {
      const d = calculateDistanceKm(refLat, refLng, h.latitude, h.longitude);
      return d <= 65;
    });

    const existingNames = new Set(localCandidates.map((h) => h.name.toLowerCase().trim()));
    const freshRegistry = nearbyRegistry.filter((h) => !existingNames.has(h.name.toLowerCase().trim()));

    // Combine local discovered + nearby registry
    let hospitals = [...localCandidates, ...freshRegistry];

    // Fallback: If no facilities found within 65km (e.g. rural area or rate limit), use closest regional hubs
    if (hospitals.length === 0) {
      const sortedByProximity = [...INDIAN_HOSPITALS_DATASET].sort((a, b) => {
        const da = calculateDistanceKm(refLat, refLng, a.latitude, a.longitude);
        const db = calculateDistanceKm(refLat, refLng, b.latitude, b.longitude);
        return da - db;
      });
      hospitals = sortedByProximity.slice(0, 10);
    }

    // STEP 1: HARD CONSTRAINTS & ELIGIBILITY EVALUATION
    const processedHospitals = hospitals.map((h) => {
      const dist = calculateDistanceKm(originLat, originLng, h.latitude, h.longitude);
      const etaMinutes = calculateRealisticDriveTime(dist);

      // Hard eligibility evaluation
      let isEligible = true;
      const matchReasons: string[] = [];

      // Check 24/7 ER constraint for Emergency cases
      if (urgencyLevel === "emergency" && !h.isEmergency24x7) {
        isEligible = false;
      } else if (h.isEmergency24x7) {
        matchReasons.push("24/7 Emergency Department");
      }

      // Check Specialty capability match with robust medical synonym mapping
      if (specialtyFilter && specialtyFilter !== "all") {
        const sFilter = specialtyFilter.toLowerCase();
        const hospName = h.name.toLowerCase();

        // 1. Direct name match for specialized institutes
        const nameMatches = 
          hospName.includes(sFilter) ||
          (sFilter.includes("cancer") && (hospName.includes("cancer") || hospName.includes("oncol") || hospName.includes("tumor"))) ||
          (sFilter.includes("oncol") && (hospName.includes("cancer") || hospName.includes("oncol"))) ||
          (sFilter.includes("heart") && (hospName.includes("heart") || hospName.includes("cardio") || hospName.includes("chest") || hospName.includes("hruday"))) ||
          (sFilter.includes("cardio") && (hospName.includes("heart") || hospName.includes("cardio") || hospName.includes("chest") || hospName.includes("hruday"))) ||
          (sFilter.includes("brain") && (hospName.includes("neuro") || hospName.includes("stroke") || hospName.includes("brain") || hospName.includes("nimhans"))) ||
          (sFilter.includes("neuro") && (hospName.includes("neuro") || hospName.includes("stroke") || hospName.includes("brain"))) ||
          (sFilter.includes("stroke") && (hospName.includes("neuro") || hospName.includes("stroke"))) ||
          (sFilter.includes("child") && (hospName.includes("child") || hospName.includes("pediatric") || hospName.includes("rainbow") || hospName.includes("ankura") || hospName.includes("lotus"))) ||
          (sFilter.includes("pediatric") && (hospName.includes("child") || hospName.includes("pediatric") || hospName.includes("rainbow") || hospName.includes("ankura"))) ||
          (sFilter.includes("bone") && (hospName.includes("ortho") || hospName.includes("bone") || hospName.includes("joint") || hospName.includes("trauma") || hospName.includes("fracture"))) ||
          (sFilter.includes("ortho") && (hospName.includes("ortho") || hospName.includes("bone") || hospName.includes("joint") || hospName.includes("trauma") || hospName.includes("fracture"))) ||
          (sFilter.includes("kidney") && (hospName.includes("kidney") || hospName.includes("nephro") || hospName.includes("dialysis") || hospName.includes("renal") || hospName.includes("urol"))) ||
          (sFilter.includes("renal") && (hospName.includes("kidney") || hospName.includes("nephro") || hospName.includes("dialysis") || hospName.includes("renal"))) ||
          (sFilter.includes("dialysis") && (hospName.includes("kidney") || hospName.includes("nephro") || hospName.includes("dialysis") || hospName.includes("renal"))) ||
          (sFilter.includes("ayurved") && (hospName.includes("ayurved") || hospName.includes("ayush") || hospName.includes("panchakarma") || hospName.includes("herbal"))) ||
          (sFilter.includes("lung") && (hospName.includes("lung") || hospName.includes("pulmo") || hospName.includes("chest") || hospName.includes("resp"))) ||
          (sFilter.includes("pulmo") && (hospName.includes("lung") || hospName.includes("pulmo") || hospName.includes("chest") || hospName.includes("resp"))) ||
          (sFilter.includes("eye") && (hospName.includes("eye") || hospName.includes("ophthal") || hospName.includes("netra") || hospName.includes("lvpei") || hospName.includes("vision"))) ||
          (sFilter.includes("matern") && (hospName.includes("matern") || hospName.includes("women") || hospName.includes("gynec") || hospName.includes("mother") || hospName.includes("birth"))) ||
          (sFilter.includes("preg") && (hospName.includes("matern") || hospName.includes("women") || hospName.includes("gynec") || hospName.includes("mother"))) ||
          (sFilter.includes("gastro") && (hospName.includes("gastro") || hospName.includes("liver") || hospName.includes("digestive") || hospName.includes("stomach"))) ||
          (sFilter.includes("liver") && (hospName.includes("gastro") || hospName.includes("liver"))) ||
          (sFilter.includes("ent") && (hospName.includes("ent") || hospName.includes("ear") || hospName.includes("throat"))) ||
          (sFilter.includes("derma") && (hospName.includes("derma") || hospName.includes("skin"))) ||
          (sFilter.includes("skin") && (hospName.includes("derma") || hospName.includes("skin"))) ||
          (sFilter.includes("dental") && (hospName.includes("dental") || hospName.includes("tooth") || hospName.includes("teeth"))) ||
          (sFilter.includes("diabetes") && (hospName.includes("diabet") || hospName.includes("endocrin")));

        // 2. Specialty list match
        const specialtyMatches = h.specialty.some((s) => {
          const lower = s.toLowerCase();
          if (lower.includes(sFilter)) return true;
          if (sFilter.includes("cancer") && (lower.includes("oncol") || lower.includes("tumor") || h.cancerSpecialistsAvailable)) return true;
          if (sFilter.includes("oncol") && (lower.includes("cancer") || lower.includes("tumor") || h.cancerSpecialistsAvailable)) return true;
          if (sFilter.includes("tumor") && (lower.includes("cancer") || lower.includes("oncol") || h.cancerSpecialistsAvailable)) return true;
          if (sFilter.includes("heart") && (lower.includes("cardio") || lower.includes("chest"))) return true;
          if (sFilter.includes("cardio") && (lower.includes("heart") || lower.includes("chest"))) return true;
          if (sFilter.includes("brain") && (lower.includes("neuro") || lower.includes("stroke"))) return true;
          if (sFilter.includes("neuro") && (lower.includes("stroke") || lower.includes("brain"))) return true;
          if (sFilter.includes("stroke") && lower.includes("neuro")) return true;
          if (sFilter.includes("child") && (lower.includes("pediatric") || lower.includes("maternity") || lower.includes("nicu") || lower.includes("picu"))) return true;
          if (sFilter.includes("pediatric") && (lower.includes("child") || lower.includes("maternity"))) return true;
          if (sFilter.includes("bone") && (lower.includes("ortho") || lower.includes("fracture") || lower.includes("trauma"))) return true;
          if (sFilter.includes("ortho") && (lower.includes("bone") || lower.includes("trauma") || lower.includes("fracture"))) return true;
          if (sFilter.includes("fracture") && (lower.includes("ortho") || lower.includes("trauma"))) return true;
          if (sFilter.includes("kidney") && (lower.includes("nephro") || lower.includes("dialysis") || lower.includes("renal") || lower.includes("urol"))) return true;
          if (sFilter.includes("renal") && (lower.includes("nephro") || lower.includes("dialysis") || lower.includes("kidney"))) return true;
          if (sFilter.includes("dialysis") && (lower.includes("nephro") || lower.includes("kidney") || lower.includes("renal"))) return true;
          if (sFilter.includes("ayurved") && (lower.includes("ayurved") || lower.includes("traditional") || lower.includes("herbal"))) return true;
          if (sFilter.includes("lung") && (lower.includes("pulmo") || lower.includes("respiratory") || lower.includes("chest"))) return true;
          if (sFilter.includes("pulmo") && (lower.includes("pulmo") || lower.includes("respiratory") || lower.includes("chest"))) return true;
          if (sFilter.includes("eye") && (lower.includes("ophthal") || lower.includes("eye"))) return true;
          if (sFilter.includes("matern") && (lower.includes("gynec") || lower.includes("obstet") || lower.includes("nicu") || lower.includes("maternity"))) return true;
          if (sFilter.includes("preg") && (lower.includes("gynec") || lower.includes("obstet") || lower.includes("maternity"))) return true;
          if (sFilter.includes("gastro") && (lower.includes("gastro") || lower.includes("liver"))) return true;
          if (sFilter.includes("liver") && (lower.includes("gastro") || lower.includes("liver"))) return true;
          if (sFilter.includes("ent") && lower.includes("ent")) return true;
          if (sFilter.includes("derma") && (lower.includes("derma") || lower.includes("skin"))) return true;
          if (sFilter.includes("skin") && (lower.includes("derma") || lower.includes("skin"))) return true;
          if (sFilter.includes("dental") && lower.includes("dental")) return true;
          if (sFilter.includes("diabetes") && (lower.includes("diabet") || lower.includes("endocrin"))) return true;
          if (sFilter.includes("emergency") && (lower.includes("emergency") || lower.includes("trauma"))) return true;
          return false;
        }) || (sFilter.includes("cancer") && Boolean(h.cancerSpecialistsAvailable));

        if (!nameMatches && !specialtyMatches) {
          isEligible = false;
        } else {
          matchReasons.push(`Specialized ${specialtyFilter.charAt(0).toUpperCase() + specialtyFilter.slice(1)} Department`);
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

      const famousFor = (h as any).famousFor || getHospitalFamousFor(h);

      return {
        id: h.id,
        name: h.name,
        specialty: h.specialty,
        famousFor,
        city: h.city,
        state: h.state,
        address: h.address,
        phone: h.phone,
        emergencyPhone: h.emergencyPhone,
        latitude: h.latitude,
        longitude: h.longitude,
        ownership: h.ownership || "private",
        affordabilityNotes: h.affordabilityNotes,
        acceptsPublicInsurance: h.acceptsPublicInsurance,
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
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${encodeURIComponent(
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
      userLocationDetected: latProvided && lngProvided,
      userCoordinates: { lat: refLat, lng: refLng },
      hospitals: sortedHospitals,
    });
  } catch (error: any) {
    console.error("[HospitalsRouteError]", error);
    return NextResponse.json(
      {
        status: "error",
        message: process.env.NODE_ENV === "production" ? "Failed to retrieve healthcare facilities directory" : (error?.message || "Failed to fetch hospital care routing data"),
      },
      { status: 500 }
    );
  }
}
