// Resource Allocation Calculator — humanitarian logistics engine
// Based on Sphere Project Minimum Standards for humanitarian response

// Daily per-person requirements (Sphere Standards)
export const SPHERE_STANDARDS = {
  food_kg_per_person_day: 0.5,        // 2100 kcal minimum → ~0.5kg food
  water_liters_per_person_day: 15,     // 15L minimum (drinking + cooking + hygiene)
  medical_kits_per_10000: 1,           // 1 basic health kit per 10,000 people
  blankets_per_person: 1,
  shelter_sqm_per_family: 3.5,         // minimum covered area per person
  hygiene_kits_per_family: 1,          // 1 kit per 5-person family
};

// Average family size in crisis zones
const AVG_FAMILY_SIZE = 5;

// Cost estimates (USD) — adjustable per region
export const DEFAULT_UNIT_COSTS = {
  food_per_kg: 0.8,
  water_per_liter: 0.05,
  medical_kit: 650,
  blanket: 8,
  shelter_unit: 45,
  hygiene_kit: 25,
};

// Crisis severity multipliers
const CRISIS_MULTIPLIERS = {
  low: 1.0,
  moderate: 1.3,
  high: 1.6,
  critical: 2.0,
};

// Duration-based escalation factor (longer crises need more sustained supply)
const durationFactor = (days) => 1 + Math.min(days / 90, 0.5);

export function calculateResourceAllocation({
  population,
  durationDays = 7,
  crisisSeverity = "moderate",
  childrenPct = 40,       // % of population under 14 (higher nutritional need)
  displacedPct = 100,     // % displaced from homes
  unitCosts = DEFAULT_UNIT_COSTS,
}) {
  const affectedPopulation = Math.round(population * (displacedPct / 100));
  const severityMult = CRISIS_MULTIPLIERS[crisisSeverity] || 1.3;
  const durFactor = durationFactor(durationDays);
  const totalMult = severityMult * durFactor;

  // Children need 20% more food, 30% more water
  const adjustedFoodPerPerson =
    SPHERE_STANDARDS.food_kg_per_person_day * (1 + (childrenPct / 100) * 0.2);
  const adjustedWaterPerPerson =
    SPHERE_STANDARDS.water_liters_per_person_day * (1 + (childrenPct / 100) * 0.3);

  const totalFoodKg = Math.round(
    affectedPopulation * adjustedFoodPerPerson * durationDays * totalMult
  );
  const totalWaterLiters = Math.round(
    affectedPopulation * adjustedWaterPerPerson * durationDays * totalMult
  );
  const medicalKits = Math.ceil(
    (affectedPopulation / 10000) * SPHERE_STANDARDS.medical_kits_per_10000 * totalMult
  );
  const blankets = Math.ceil(affectedPopulation * totalMult);
  const families = Math.ceil(affectedPopulation / AVG_FAMILY_SIZE);
  const shelterUnits = Math.ceil(families * totalMult);
  const hygieneKits = Math.ceil(families * totalMult);

  const foodCost = totalFoodKg * unitCosts.food_per_kg;
  const waterCost = totalWaterLiters * unitCosts.water_per_liter;
  const medicalCost = medicalKits * unitCosts.medical_kit;
  const blanketCost = blankets * unitCosts.blanket;
  const shelterCost = shelterUnits * unitCosts.shelter_unit;
  const hygieneCost = hygieneKits * unitCosts.hygiene_kit;

  const totalCost = Math.round(
    foodCost + waterCost + medicalCost + blanketCost + shelterCost + hygieneCost
  );

  // Per-day breakdown
  const dailyFoodKg = Math.round(totalFoodKg / durationDays);
  const dailyWaterLiters = Math.round(totalWaterLiters / durationDays);

  // Logistics: trucks needed (1 truck ≈ 10 tons = 10,000 kg)
  const trucksPerDay = Math.ceil(dailyFoodKg / 10000 + dailyWaterLiters / 5000);

  return {
    affectedPopulation,
    resources: [
      { name: "Food (dry rations)", unit: "kg", total: totalFoodKg, daily: dailyFoodKg, cost: Math.round(foodCost), icon: "utensils", category: "food" },
      { name: "Clean Water", unit: "liters", total: totalWaterLiters, daily: dailyWaterLiters, cost: Math.round(waterCost), icon: "droplet", category: "water" },
      { name: "Medical Kits", unit: "kits", total: medicalKits, daily: Math.ceil(medicalKits / durationDays), cost: Math.round(medicalCost), icon: "cross", category: "medical" },
      { name: "Blankets", unit: "units", total: blankets, daily: Math.ceil(blankets / durationDays), cost: Math.round(blanketCost), icon: "bed", category: "shelter" },
      { name: "Shelter Units (tarpaulin)", unit: "units", total: shelterUnits, daily: Math.ceil(shelterUnits / durationDays), cost: Math.round(shelterCost), icon: "tent", category: "shelter" },
      { name: "Hygiene Kits", unit: "kits", total: hygieneKits, daily: Math.ceil(hygieneKits / durationDays), cost: Math.round(hygieneCost), icon: "spray", category: "hygiene" },
    ],
    totalCost,
    logistics: {
      trucksPerDay,
      totalDeliveries: trucksPerDay * durationDays,
    },
    multipliers: {
      severity: severityMult,
      duration: durFactor,
      combined: totalMult,
    },
  };
}