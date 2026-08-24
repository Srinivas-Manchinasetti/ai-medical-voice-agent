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

    let hospitals = [...INDIAN_HOSPITALS_DATASET];

    // Filter by specialty if requested (e.g. "cancer", "oncology", "cardiology", "emergency")
    if (specialtyFilter && specialtyFilter !== "all") {
      hospitals = hospitals.filter((h) => {
        if (specialtyFilter.includes("cancer") || specialtyFilter.includes("oncology")) {
          return h.cancerSpecialistsAvailable || h.specialty.some(s => s.toLowerCase().includes("cancer") || s.toLowerCase().includes("oncology"));
        }
        return h.specialty.some((s) => s.toLowerCase().includes(specialtyFilter));
      });
    }

    // Filter by search term or city if provided
    if (searchFilter || cityFilter) {
      const term = searchFilter || cityFilter;
      hospitals = hospitals.filter((h) =>
        h.name.toLowerCase().includes(term) ||
        h.city.toLowerCase().includes(term) ||
        h.state.toLowerCase().includes(term) ||
        h.address.toLowerCase().includes(term) ||
        h.specialty.some((s) => s.toLowerCase().includes(term))
      );
    }

    // Default reference coords if user GPS is not available (e.g. Hyderabad / Central India)
    const refLat = userLat !== null && !isNaN(userLat) ? userLat : 17.4326;
    const refLng = userLng !== null && !isNaN(userLng) ? userLng : 78.4071;

    // Calculate distance for all matching hospitals
    const hospitalsWithDistance = hospitals.map((h) => {
      const dist = calculateDistanceKm(refLat, refLng, h.latitude, h.longitude);
      return {
        ...h,
        distanceKm: dist,
        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${h.name}, ${h.address}`
        )}`,
      };
    });

    // Sort strictly by distance in KM (closest first)
    hospitalsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    return NextResponse.json({
      status: "success",
      count: hospitalsWithDistance.length,
      userLocationDetected: userLat !== null && userLng !== null,
      userCoordinates: userLat !== null && userLng !== null ? { lat: userLat, lng: userLng } : null,
      hospitals: hospitalsWithDistance,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed to fetch hospital data" },
      { status: 500 }
    );
  }
}
