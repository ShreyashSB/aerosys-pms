/**
 * Annexure / BOQ templates used by the demo seed. Quantities are scaled per
 * project; the final lump-sum item absorbs the remainder so every BOQ totals
 * exactly the work order value.
 */
export interface BoqTemplateItem {
  description: string;
  uom: string;
  qty: number;
  rate: number;
}

export const BOQ_TEMPLATES: Record<string, { items: BoqTemplateItem[]; lumpSum: string }> = {
  chillerRetrofit: {
    items: [
      { description: "Dismantling & shifting of existing AHUs", uom: "Nos", qty: 18, rate: 9500 },
      { description: "Installation of Air Handling Unit (AHU)", uom: "Nos", qty: 32, rate: 16000 },
      { description: "Installation of Fan Coil Units (FCU)", uom: "Nos", qty: 140, rate: 2800 },
      { description: "GI ducting fabrication & installation", uom: "Sqm", qty: 5200, rate: 320 },
      { description: "Duct insulation – 19 mm nitrile rubber", uom: "Sqm", qty: 4800, rate: 110 },
      { description: "Chilled water piping installation (MS, up to 200 NB)", uom: "Rmt", qty: 1850, rate: 420 },
      { description: "Butterfly & balancing valve installation", uom: "Nos", qty: 260, rate: 850 },
      { description: "Screw chiller installation & alignment", uom: "Nos", qty: 4, rate: 65000 },
      { description: "Control & power cabling", uom: "Rmt", qty: 2400, rate: 85 },
    ],
    lumpSum: "Testing, adjusting, balancing & commissioning",
  },
  vrf: {
    items: [
      { description: "Installation of VRF outdoor units", uom: "Nos", qty: 24, rate: 18000 },
      { description: "Installation of indoor units (cassette / ductable)", uom: "Nos", qty: 310, rate: 2200 },
      { description: "Refrigerant copper piping with insulation", uom: "Rmt", qty: 6800, rate: 380 },
      { description: "Condensate drain piping (uPVC)", uom: "Rmt", qty: 3200, rate: 140 },
      { description: "Communication & control cabling", uom: "Rmt", qty: 5400, rate: 45 },
      { description: "Fresh air unit (FAU) installation", uom: "Nos", qty: 12, rate: 14000 },
      { description: "GI ducting for FAU / ERV", uom: "Sqm", qty: 2100, rate: 320 },
      { description: "Nitrogen pressure testing & vacuum", uom: "Set", qty: 24, rate: 6500 },
    ],
    lumpSum: "System commissioning & handover",
  },
  ventilation: {
    items: [
      { description: "Installation of axial / inline exhaust fans", uom: "Nos", qty: 46, rate: 7500 },
      { description: "Installation of jet fans (car park)", uom: "Nos", qty: 18, rate: 9000 },
      { description: "GI ducting fabrication & installation", uom: "Sqm", qty: 3600, rate: 320 },
      { description: "Motorised fire / smoke dampers", uom: "Nos", qty: 64, rate: 2600 },
      { description: "Kitchen exhaust hood & scrubber installation", uom: "Nos", qty: 6, rate: 22000 },
      { description: "VFD & control panel installation", uom: "Nos", qty: 12, rate: 8500 },
      { description: "Power & control cabling", uom: "Rmt", qty: 3800, rate: 85 },
    ],
    lumpSum: "Air balancing & performance testing",
  },
  cleanroom: {
    items: [
      { description: "Installation of double-skin AHU with HEPA section", uom: "Nos", qty: 14, rate: 24000 },
      { description: "Terminal HEPA filter boxes installation", uom: "Nos", qty: 180, rate: 2400 },
      { description: "GI / SS ducting fabrication & installation", uom: "Sqm", qty: 4200, rate: 360 },
      { description: "Duct insulation – 25 mm nitrile rubber", uom: "Sqm", qty: 3900, rate: 125 },
      { description: "Pressure control & VAV dampers", uom: "Nos", qty: 96, rate: 3200 },
      { description: "Chilled water piping installation", uom: "Rmt", qty: 1400, rate: 420 },
      { description: "BMS sensors & cabling", uom: "Rmt", qty: 2600, rate: 95 },
    ],
    lumpSum: "Validation support – DQ / IQ / OQ & room classification",
  },
  precisionCooling: {
    items: [
      { description: "Precision air conditioning (PAC) unit installation", uom: "Nos", qty: 16, rate: 28000 },
      { description: "In-row cooling unit installation", uom: "Nos", qty: 40, rate: 9500 },
      { description: "Chilled water piping installation", uom: "Rmt", qty: 2600, rate: 420 },
      { description: "Leak detection system & cabling", uom: "Rmt", qty: 1800, rate: 90 },
      { description: "Chiller & free-cooling module installation", uom: "Nos", qty: 3, rate: 75000 },
    ],
    lumpSum: "Integrated systems testing (IST) & commissioning",
  },
  ducting: {
    items: [
      { description: "GI ducting fabrication & installation", uom: "Sqm", qty: 3400, rate: 320 },
      { description: "Duct insulation – 19 mm nitrile rubber", uom: "Sqm", qty: 3100, rate: 110 },
      { description: "Supply / return diffusers & grilles", uom: "Nos", qty: 420, rate: 650 },
      { description: "Volume control dampers", uom: "Nos", qty: 160, rate: 900 },
    ],
    lumpSum: "Duct leakage testing & air balancing",
  },
};

/** Whole-number UOMs; others allow decimals. */
export const DISCRETE_UOMS = new Set(["Nos", "Set"]);
