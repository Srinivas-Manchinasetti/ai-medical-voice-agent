export interface Hospital {
  id: string;
  name: string;
  specialty: string[];
  city: string;
  state: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  latitude: number;
  longitude: number;
  isEmergency24x7: boolean;
  rating: number;
  accreditation: string[];
  cancerSpecialistsAvailable?: boolean;
}

/**
 * Haversine formula to compute distance in kilometers between two GPS coordinates
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
}

export const INDIAN_HOSPITALS_DATASET: Hospital[] = [
  // --- HYDERABAD & TELANGANA ---
  {
    id: "hosp-hyd-01",
    name: "Apollo Cancer Centre & Multi-Specialty Hospital",
    specialty: ["Oncology / Cancer", "Cardiology", "Emergency & Trauma", "Neurology"],
    city: "Hyderabad",
    state: "Telangana",
    address: "Jubilee Hills, Road No. 72, Film Nagar, Hyderabad, Telangana 500033",
    phone: "+91 40 2360 7777",
    emergencyPhone: "1066",
    latitude: 17.4326,
    longitude: 78.4071,
    isEmergency24x7: true,
    rating: 4.8,
    accreditation: ["NABH", "JCI"],
    cancerSpecialistsAvailable: true,
  },
  {
    id: "hosp-hyd-02",
    name: "Basavatarakam Indo-American Cancer Hospital & Research Institute",
    specialty: ["Oncology / Cancer", "Pediatric Oncology", "Surgical Oncology"],
    city: "Hyderabad",
    state: "Telangana",
    address: "Road No 10, Banjara Hills, Hyderabad, Telangana 500034",
    phone: "+91 40 2355 1235",
    emergencyPhone: "+91 40 2355 1235",
    latitude: 17.4187,
    longitude: 78.4385,
    isEmergency24x7: true,
    rating: 4.7,
    accreditation: ["NABH", "NABL"],
    cancerSpecialistsAvailable: true,
  },
  {
    id: "hosp-hyd-03",
    name: "KIMS Hospitals (Krishna Institute of Medical Sciences)",
    specialty: ["Emergency & Trauma", "Cardiology", "Neurology", "Oncology / Cancer"],
    city: "Hyderabad",
    state: "Telangana",
    address: "1-8-31/1, Minister Road, Secunderabad, Hyderabad, Telangana 500003",
    phone: "+91 40 4488 5000",
    emergencyPhone: "+91 40 4488 5000",
    latitude: 17.4428,
    longitude: 78.4872,
    isEmergency24x7: true,
    rating: 4.6,
    accreditation: ["NABH"],
    cancerSpecialistsAvailable: true,
  },
  {
    id: "hosp-hyd-04",
    name: "Yashoda Hospitals - Hitec City",
    specialty: ["Oncology / Cancer", "Emergency & Trauma", "Cardiology", "Pediatrics"],
    city: "Hyderabad",
    state: "Telangana",
    address: "Beside IKEA, Hitec City, Hyderabad, Telangana 500081",
    phone: "+91 40 4567 4567",
    emergencyPhone: "+91 40 4567 4567",
    latitude: 17.4435,
    longitude: 78.3772,
    isEmergency24x7: true,
    rating: 4.8,
    accreditation: ["NABH", "NABL"],
    cancerSpecialistsAvailable: true,
  },

  // --- BENGALURU & KARNATAKA ---
  {
    id: "hosp-blr-01",
    name: "HCG Cancer Centre (Healthcare Global)",
    specialty: ["Oncology / Cancer", "Radiation Oncology", "Medical Oncology"],
    city: "Bengaluru",
    state: "Karnataka",
    address: "#8, HCG Tower, P. Kalinga Rao Road, Sampangi Rama Nagar, Bengaluru, Karnataka 560027",
    phone: "+91 80 4020 6000",
    emergencyPhone: "+91 80 4020 6000",
    latitude: 12.9612,
    longitude: 77.5898,
    isEmergency24x7: true,
    rating: 4.8,
    accreditation: ["NABH", "NABL"],
    cancerSpecialistsAvailable: true,
  },
  {
    id: "hosp-blr-02",
    name: "Manipal Hospital Old Airport Road",
    specialty: ["Emergency & Trauma", "Oncology / Cancer", "Cardiology", "Pediatrics"],
    city: "Bengaluru",
    state: "Karnataka",
    address: "98, HAL Old Airport Rd, Kodihalli, Bengaluru, Karnataka 560017",
    phone: "+91 80 2502 4444",
    emergencyPhone: "105533",
    latitude: 12.9584,
    longitude: 77.6491,
    isEmergency24x7: true,
    rating: 4.7,
    accreditation: ["NABH", "JCI"],
    cancerSpecialistsAvailable: true,
  },
  {
    id: "hosp-blr-03",
    name: "Narayana Health City (Mazumdar Shaw Medical Center)",
    specialty: ["Oncology / Cancer", "Cardiology", "Pediatrics", "Emergency & Trauma"],
    city: "Bengaluru",
    state: "Karnataka",
    address: "258/A, Bommasandra Industrial Area, Hosur Road, Bengaluru, Karnataka 560099",
    phone: "+91 80 7122 2222",
    emergencyPhone: "+91 80 7122 2222",
    latitude: 12.8123,
    longitude: 77.6908,
    isEmergency24x7: true,
    rating: 4.8,
    accreditation: ["JCI", "NABH"],
    cancerSpecialistsAvailable: true,
  },

  // --- MUMBAI & MAHARASHTRA ---
  {
    id: "hosp-mum-01",
    name: "Tata Memorial Centre (TMC Cancer Institute)",
    specialty: ["Oncology / Cancer", "Pediatric Oncology", "Surgical Oncology", "Radiation Therapy"],
    city: "Mumbai",
    state: "Maharashtra",
    address: "Dr. Ernest Borges Road, Parel, Mumbai, Maharashtra 400012",
    phone: "+91 22 2417 7000",
    emergencyPhone: "+91 22 2417 7000",
    latitude: 19.0035,
    longitude: 72.8431,
    isEmergency24x7: true,
    rating: 4.9,
    accreditation: ["NABH", "NABL"],
    cancerSpecialistsAvailable: true,
  },
  {
    id: "hosp-mum-02",
    name: "Kokilaben Dhirubhai Ambani Hospital",
    specialty: ["Oncology / Cancer", "Cardiology", "Neurology", "Emergency & Trauma"],
    city: "Mumbai",
    state: "Maharashtra",
    address: "Rao Saheb, Achutrao Patwardhan Marg, Four Bungalows, Andheri West, Mumbai, Maharashtra 400053",
    phone: "+91 22 4269 6969",
    emergencyPhone: "+91 22 4269 9999",
    latitude: 19.1312,
    longitude: 72.8252,
    isEmergency24x7: true,
    rating: 4.8,
    accreditation: ["JCI", "NABH"],
    cancerSpecialistsAvailable: true,
  },
  {
    id: "hosp-mum-03",
    name: "Nanavati Max Super Speciality Hospital",
    specialty: ["Emergency & Trauma", "Oncology / Cancer", "Cardiology", "Neurology"],
    city: "Mumbai",
    state: "Maharashtra",
    address: "SV Rd, near LIC Colony, Suresh Colony, Vile Parle West, Mumbai, Maharashtra 400056",
    phone: "+91 22 2626 7500",
    emergencyPhone: "+91 22 2626 7500",
    latitude: 19.0963,
    longitude: 72.8407,
    isEmergency24x7: true,
    rating: 4.6,
    accreditation: ["NABH"],
    cancerSpecialistsAvailable: true,
  },

  // --- DELHI NCR ---
  {
    id: "hosp-del-01",
    name: "Rajiv Gandhi Cancer Institute and Research Centre (RGCI)",
    specialty: ["Oncology / Cancer", "Bone Marrow Transplant", "Radiation Oncology"],
    city: "New Delhi",
    state: "Delhi NCR",
    address: "Sir Chotu Ram Marg, Sector 5, Rohini, New Delhi, Delhi 110085",
    phone: "+91 11 4702 2222",
    emergencyPhone: "+91 11 4702 2222",
    latitude: 28.7183,
    longitude: 77.1136,
    isEmergency24x7: true,
    rating: 4.8,
    accreditation: ["NABH", "NABL"],
    cancerSpecialistsAvailable: true,
  },
  {
    id: "hosp-del-02",
    name: "All India Institute of Medical Sciences (AIIMS)",
    specialty: ["Emergency & Trauma", "Oncology / Cancer", "Cardiology", "Neurology", "Pediatrics"],
    city: "New Delhi",
    state: "Delhi NCR",
    address: "Sri Aurobindo Marg, Ansari Nagar, New Delhi, Delhi 110029",
    phone: "+91 11 2658 8500",
    emergencyPhone: "+91 11 2658 8700",
    latitude: 28.5672,
    longitude: 77.2100,
    isEmergency24x7: true,
    rating: 4.9,
    accreditation: ["Govt Center of Excellence", "NABH"],
    cancerSpecialistsAvailable: true,
  },
  {
    id: "hosp-del-03",
    name: "Max Super Speciality Hospital, Saket",
    specialty: ["Oncology / Cancer", "Cardiology", "Emergency & Trauma", "Neurology"],
    city: "New Delhi",
    state: "Delhi NCR",
    address: "1, 2 Press Enclave Marg, Saket Institutional Area, Saket, New Delhi, Delhi 110017",
    phone: "+91 11 2651 5050",
    emergencyPhone: "+91 11 2651 5050",
    latitude: 28.5284,
    longitude: 77.2123,
    isEmergency24x7: true,
    rating: 4.7,
    accreditation: ["NABH", "JCI"],
    cancerSpecialistsAvailable: true,
  },
  {
    id: "hosp-del-04",
    name: "Medanta - The Medicity",
    specialty: ["Cardiology", "Oncology / Cancer", "Emergency & Trauma", "Neurology"],
    city: "Gurugram",
    state: "Delhi NCR",
    address: "CH Baktawar Singh Road, Sector 38, Gurugram, Haryana 122001",
    phone: "+91 124 414 1414",
    emergencyPhone: "+91 124 414 1414",
    latitude: 28.4384,
    longitude: 77.0427,
    isEmergency24x7: true,
    rating: 4.8,
    accreditation: ["JCI", "NABH"],
    cancerSpecialistsAvailable: true,
  },

  // --- CHENNAI & TAMIL NADU ---
  {
    id: "hosp-che-01",
    name: "Cancer Institute (WIA) Adyar",
    specialty: ["Oncology / Cancer", "Radiation Oncology", "Pediatric Cancer"],
    city: "Chennai",
    state: "Tamil Nadu",
    address: "East Canal Bank Road, Gandhi Nagar, Adyar, Chennai, Tamil Nadu 600020",
    phone: "+91 44 2491 0792",
    emergencyPhone: "+91 44 2491 0792",
    latitude: 13.0067,
    longitude: 80.2570,
    isEmergency24x7: true,
    rating: 4.8,
    accreditation: ["NABH"],
    cancerSpecialistsAvailable: true,
  },
  {
    id: "hosp-che-02",
    name: "Apollo Speciality Cancer Hospital Teynampet",
    specialty: ["Oncology / Cancer", "Proton Therapy", "Bone Marrow Transplant"],
    city: "Chennai",
    state: "Tamil Nadu",
    address: "320, Anna Salai, Teynampet, Chennai, Tamil Nadu 600035",
    phone: "+91 44 2433 6119",
    emergencyPhone: "+91 44 2433 6119",
    latitude: 13.0382,
    longitude: 80.2458,
    isEmergency24x7: true,
    rating: 4.8,
    accreditation: ["JCI", "NABH"],
    cancerSpecialistsAvailable: true,
  },

  // --- KOLKATA & EAST INDIA ---
  {
    id: "hosp-kol-01",
    name: "Tata Medical Center New Town",
    specialty: ["Oncology / Cancer", "Hematology", "Radiation Oncology"],
    city: "Kolkata",
    state: "West Bengal",
    address: "14, MAR(EW), New Town, Rajarhat, Kolkata, West Bengal 700160",
    phone: "+91 33 6605 7000",
    emergencyPhone: "+91 33 6605 7000",
    latitude: 22.5807,
    longitude: 88.4687,
    isEmergency24x7: true,
    rating: 4.8,
    accreditation: ["NABH", "NABL"],
    cancerSpecialistsAvailable: true,
  },

  // --- PUNE ---
  {
    id: "hosp-pune-01",
    name: "Ruby Hall Clinic & Cancer Center",
    specialty: ["Oncology / Cancer", "Cardiology", "Emergency & Trauma"],
    city: "Pune",
    state: "Maharashtra",
    address: "40, Sassoon Road, Sangamvadi, Pune, Maharashtra 411001",
    phone: "+91 20 6645 5100",
    emergencyPhone: "+91 20 6645 5100",
    latitude: 18.5286,
    longitude: 73.8744,
    isEmergency24x7: true,
    rating: 4.7,
    accreditation: ["NABH"],
    cancerSpecialistsAvailable: true,
  },
];
