const FRAIS_FIXES = 1350;

const donationBrackets = [
  { max: 8072, rate: 0.05 },
  { max: 12109, rate: 0.1 },
  { max: 15932, rate: 0.15 },
  { max: 552324, rate: 0.2 },
  { max: 902838, rate: 0.3 },
  { max: 1805677, rate: 0.4 },
  { max: Infinity, rate: 0.45 },
];

const el = {
  nbEnfants: document.getElementById("nbEnfants"),
  dossierNom: document.getElementById("dossierNom"),
  situation: document.getElementById("situation"),
  hasAnterieure: document.getElementById("hasAnterieure"),
  anterieureField: document.getElementById("anterieureField"),
  montantAnterieure: document.getElementById("montantAnterieure"),
  abattement: document.getElementById("abattement"),
  biensContainer: document.getElementById("biensContainer"),
  addBienBtn: document.getElementById("addBienBtn"),
  bienTemplate: document.getElementById("bienTemplate"),
  kpiTotalDonne: document.getElementById("kpiTotalDonne"),
  kpiParEnfant: document.getElementById("kpiParEnfant"),
  kpiTaxable: document.getElementById("kpiTaxable"),
  kpiDroits: document.getElementById("kpiDroits"),
  kpiCout: document.getElementById("kpiCout"),
  repartitionText: document.getElementById("repartitionText"),
  generateBtn: document.getElementById("generateBtn"),
  notePreview: document.getElementById("notePreview"),
};

function currency(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0);
}

function usufruitRateByAge(age) {
  if (age < 21) return 0.9;
  if (age < 31) return 0.8;
  if (age < 41) return 0.7;
  if (age < 51) return 0.6;
  if (age < 61) return 0.5;
  if (age < 71) return 0.4;
  if (age < 81) return 0.3;
  if (age < 91) return 0.2;
  return 0.1;
}

function calculateProgressiveTax(amount) {
  let previous = 0;
  let remaining = amount;
  let tax = 0;

  for (const bracket of donationBrackets) {
    if (remaining <= 0) break;
    const trancheSize = Math.min(remaining, bracket.max - previous);
    tax += trancheSize * bracket.rate;
    remaining -= trancheSize;
    previous = bracket.max;
  }

  return Math.max(0, tax);
}

function readBiens() {
  const cards = [...el.biensContainer.querySelectorAll(".bien-card")];
  return cards.map((card, index) => {
    const valeur = Number(card.querySelector(".bien-valeur").value) || 0;
    const age = Number(card.querySelector(".bien-age").value) || 0;
    const type = card.querySelector(".bien-type").value;
    const owner = card.querySelector(".bien-owner").value || "Non précisé";

    const usufruitRate = usufruitRateByAge(age);
    const nueProprieteRate = 1 - usufruitRate;
    const nueProprieteValue = valeur * nueProprieteRate;

    card.querySelector(".usufruit-value").textContent = `${Math.round(usufruitRate * 100)} %`;
    card.querySelector(".nuepro-value").textContent = currency(nueProprieteValue);
    card.querySelector(".bien-index").textContent = String(index + 1);

    return { index: index + 1, type, owner, valeur, age, usufruitRate, nueProprieteValue };
  });
}

function compute() {
  const nbEnfants = Math.max(1, Number(el.nbEnfants.value) || 1);
  const abattement = Math.max(0, Number(el.abattement.value) || 0);
  const donationAnterieure = el.hasAnterieure.checked ? Math.max(0, Number(el.montantAnterieure.value) || 0) : 0;

  const biens = readBiens();
  const totalNuePropriete = biens.reduce((sum, bien) => sum + bien.nueProprieteValue, 0);
  const partParEnfant = totalNuePropriete / nbEnfants;

  const chargeAnterieureParEnfant = donationAnterieure / nbEnfants;
  const abattementDisponible = Math.max(0, abattement - chargeAnterieureParEnfant);
  const taxableParEnfant = Math.max(0, partParEnfant - abattementDisponible);
  const droitsParEnfant = calculateProgressiveTax(taxableParEnfant);
  const droitsTotal = droitsParEnfant * nbEnfants;
  const coutTotal = droitsTotal + FRAIS_FIXES;

  el.kpiTotalDonne.textContent = currency(totalNuePropriete);
  el.kpiParEnfant.textContent = currency(partParEnfant);
  el.kpiTaxable.textContent = currency(taxableParEnfant);
  el.kpiDroits.textContent = currency(droitsTotal);
  el.kpiCout.textContent = currency(coutTotal);

  el.repartitionText.textContent = biens.length
    ? `Répartition automatique sur ${nbEnfants} enfant(s), avec ${biens.length} bien(s) saisi(s).`
    : "Aucun bien saisi.";

  return {
    nbEnfants,
    abattement,
    donationAnterieure,
    abattementDisponible,
    taxableParEnfant,
    droitsTotal,
    coutTotal,
    totalNuePropriete,
    partParEnfant,
    biens,
  };
}

function createBienCard() {
  const fragment = el.bienTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".bien-card");

  card.querySelectorAll("input, select").forEach((field) => {
    field.addEventListener("input", compute);
  });

  card.querySelector(".delete-link").addEventListener("click", () => {
    card.remove();
    compute();
  });

  el.biensContainer.appendChild(fragment);
  compute();
}

function generateNote(state) {
  const dossier = el.dossierNom.value || "Sans nom";
  const situation = el.situation.value === "marie" ? "Marié(e)" : "Pacsé(e)";

  const biensText = state.biens.length
    ? state.biens
        .map((b) => `• Bien ${b.index} (${b.type}) — ${b.owner}, valeur ${currency(b.valeur)}, âge ${b.age} ans, usufruit ${Math.round(b.usufruitRate * 100)} %, nue-propriété ${currency(b.nueProprieteValue)}.`)
        .join("\n")
    : "• Aucun bien renseigné.";

  const text = `NOTE DE SYNTHÈSE — DONATION\n\nDossier : ${dossier}\nSituation : ${situation}\nNombre d'enfants : ${state.nbEnfants}\n\n1) Consistance des biens\n${biensText}\n\n2) Éléments fiscaux\n- Total transmis en nue-propriété : ${currency(state.totalNuePropriete)}\n- Part par enfant : ${currency(state.partParEnfant)}\n- Donations antérieures : ${currency(state.donationAnterieure)}\n- Abattement disponible par enfant : ${currency(state.abattementDisponible)}\n- Part taxable par enfant : ${currency(state.taxableParEnfant)}\n- Droits totaux estimés : ${currency(state.droitsTotal)}\n\n3) Coût global estimatif\n- Droits de donation : ${currency(state.droitsTotal)}\n- Frais fixes estimatifs : ${currency(FRAIS_FIXES)}\n- Coût total : ${currency(state.coutTotal)}\n\nDocument généré automatiquement à partir des données saisies.`;

  el.notePreview.textContent = text;
}

el.hasAnterieure.addEventListener("change", () => {
  el.anterieureField.classList.toggle("active", el.hasAnterieure.checked);
  compute();
});

[el.nbEnfants, el.abattement, el.montantAnterieure, el.dossierNom, el.situation].forEach((field) => {
  field.addEventListener("input", compute);
});

el.addBienBtn.addEventListener("click", createBienCard);

el.generateBtn.addEventListener("click", () => {
  const state = compute();
  generateNote(state);
  window.print();
});

createBienCard();
