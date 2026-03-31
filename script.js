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
  donor1Name: document.getElementById("donor1Name"),
  donor1Birth: document.getElementById("donor1Birth"),
  donor1Age: document.getElementById("donor1Age"),
  donor1Usufruit: document.getElementById("donor1Usufruit"),
  donor2Name: document.getElementById("donor2Name"),
  donor2Birth: document.getElementById("donor2Birth"),
  donor2Age: document.getElementById("donor2Age"),
  donor2Usufruit: document.getElementById("donor2Usufruit"),
  hasAnterieure: document.getElementById("hasAnterieure"),
  anterieureField: document.getElementById("anterieureField"),
  montantAnterieure: document.getElementById("montantAnterieure"),
  abattement: document.getElementById("abattement"),
  biensCommunsContainer: document.getElementById("biensCommunsContainer"),
  biensPropresContainer: document.getElementById("biensPropresContainer"),
  addCommunBtn: document.getElementById("addCommunBtn"),
  addPropreBtn: document.getElementById("addPropreBtn"),
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

function computeAgeFromBirthdate(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  const isBeforeBirthday = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate());
  if (isBeforeBirthday) age -= 1;

  return age >= 0 ? age : null;
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

function getDonors() {
  const donor1Age = computeAgeFromBirthdate(el.donor1Birth.value);
  const donor2Age = computeAgeFromBirthdate(el.donor2Birth.value);

  const donor1 = {
    key: "d1",
    label: el.donor1Name.value.trim() || "Donateur 1",
    age: donor1Age,
    usufruitRate: donor1Age !== null ? usufruitRateByAge(donor1Age) : null,
  };

  const donor2 = {
    key: "d2",
    label: el.donor2Name.value.trim() || "Donateur 2",
    age: donor2Age,
    usufruitRate: donor2Age !== null ? usufruitRateByAge(donor2Age) : null,
  };

  el.donor1Age.textContent = donor1.age !== null ? `${donor1.age} ans` : "—";
  el.donor2Age.textContent = donor2.age !== null ? `${donor2.age} ans` : "—";
  el.donor1Usufruit.textContent = donor1.usufruitRate !== null ? `${Math.round(donor1.usufruitRate * 100)} %` : "—";
  el.donor2Usufruit.textContent = donor2.usufruitRate !== null ? `${Math.round(donor2.usufruitRate * 100)} %` : "—";

  return { donor1, donor2 };
}

function populateOwnerSelect(select, type, donors) {
  const { donor1, donor2 } = donors;
  const previousValue = select.value;
  select.innerHTML = "";

  const options = type === "propre"
    ? [
        { value: "d1", label: donor1.label },
        { value: "d2", label: donor2.label },
      ]
    : [{ value: "commun", label: `${donor1.label} + ${donor2.label}` }];

  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  });

  if (type === "commun") {
    select.value = "commun";
    select.disabled = true;
    return;
  }

  select.disabled = false;
  if (options.some((opt) => opt.value === previousValue)) {
    select.value = previousValue;
  }
}

function refreshAllOwnerSelects(donors) {
  document.querySelectorAll(".bien-card").forEach((card) => {
    populateOwnerSelect(card.querySelector(".bien-owner"), card.dataset.type, donors);
  });
}

function computeBienNuePropriete(type, valeur, ownerKey, donors) {
  const { donor1, donor2 } = donors;

  if (type === "commun") {
    const donor1Usufruit = donor1.usufruitRate ?? 0.5;
    const donor2Usufruit = donor2.usufruitRate ?? donor1Usufruit;
    const halfValue = valeur / 2;
    const np1 = halfValue * (1 - donor1Usufruit);
    const np2 = halfValue * (1 - donor2Usufruit);
    const avgUsufruit = (donor1Usufruit + donor2Usufruit) / 2;

    return {
      usufruitRate: avgUsufruit,
      nueProprieteValue: np1 + np2,
      ownerLabel: `${donor1.label} + ${donor2.label}`,
    };
  }

  const donor = ownerKey === "d2" ? donor2 : donor1;
  const usufruitRate = donor.usufruitRate ?? 0.5;
  return {
    usufruitRate,
    nueProprieteValue: valeur * (1 - usufruitRate),
    ownerLabel: donor.label,
  };
}

function readBiens(donors) {
  const cards = [...document.querySelectorAll(".bien-card")];
  return cards.map((card, index) => {
    const type = card.dataset.type;
    const valeur = Number(card.querySelector(".bien-valeur").value) || 0;
    const ownerKey = card.querySelector(".bien-owner").value;

    const details = computeBienNuePropriete(type, valeur, ownerKey, donors);

    card.querySelector(".usufruit-value").textContent = `${Math.round(details.usufruitRate * 100)} %`;
    card.querySelector(".nuepro-value").textContent = currency(details.nueProprieteValue);
    card.querySelector(".bien-index").textContent = String(index + 1);

    return {
      index: index + 1,
      type,
      owner: details.ownerLabel,
      valeur,
      usufruitRate: details.usufruitRate,
      nueProprieteValue: details.nueProprieteValue,
    };
  });
}

function compute() {
  const donors = getDonors();
  refreshAllOwnerSelects(donors);

  const nbEnfants = Math.max(1, Number(el.nbEnfants.value) || 1);
  const abattement = Math.max(0, Number(el.abattement.value) || 0);
  const donationAnterieure = el.hasAnterieure.checked ? Math.max(0, Number(el.montantAnterieure.value) || 0) : 0;

  const biens = readBiens(donors);
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

  const nbCommuns = biens.filter((b) => b.type === "commun").length;
  const nbPropres = biens.filter((b) => b.type === "propre").length;

  el.repartitionText.textContent = biens.length
    ? `Répartition sur ${nbEnfants} enfant(s) · ${nbCommuns} bien(s) commun(s) · ${nbPropres} bien(s) propre(s).`
    : "Aucun bien saisi.";

  return {
    nbEnfants,
    donationAnterieure,
    abattementDisponible,
    taxableParEnfant,
    droitsTotal,
    coutTotal,
    totalNuePropriete,
    partParEnfant,
    biens,
    donors,
  };
}

function createBienCard(type) {
  const fragment = el.bienTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".bien-card");
  card.dataset.type = type;

  card.querySelectorAll("input, select").forEach((field) => {
    field.addEventListener("input", compute);
    field.addEventListener("change", compute);
  });

  card.querySelector(".delete-link").addEventListener("click", () => {
    card.remove();
    compute();
  });

  const ownerSelect = card.querySelector(".bien-owner");
  populateOwnerSelect(ownerSelect, type, getDonors());

  if (type === "commun") {
    el.biensCommunsContainer.appendChild(fragment);
  } else {
    el.biensPropresContainer.appendChild(fragment);
  }

  compute();
}

function generateNote(state) {
  const dossier = el.dossierNom.value || "Sans nom";
  const situation = el.situation.value === "marie" ? "Marié(e)" : "Pacsé(e)";

  const donorText = [state.donors.donor1, state.donors.donor2]
    .map((d, idx) => `- Donateur ${idx + 1}: ${d.label}, âge ${d.age ?? "non renseigné"}, usufruit ${d.usufruitRate !== null ? `${Math.round(d.usufruitRate * 100)} %` : "non calculé"}`)
    .join("\n");

  const biensText = state.biens.length
    ? state.biens
        .map((b) => `• Bien ${b.index} (${b.type}) — ${b.owner}, valeur ${currency(b.valeur)}, usufruit ${Math.round(b.usufruitRate * 100)} %, nue-propriété ${currency(b.nueProprieteValue)}.`)
        .join("\n")
    : "• Aucun bien renseigné.";

  const text = `NOTE DE SYNTHÈSE — DONATION\n\nDossier : ${dossier}\nSituation : ${situation}\nNombre d'enfants : ${state.nbEnfants}\n\n0) Donateurs\n${donorText}\n\n1) Consistance des biens\n${biensText}\n\n2) Éléments fiscaux\n- Total transmis en nue-propriété : ${currency(state.totalNuePropriete)}\n- Part par enfant : ${currency(state.partParEnfant)}\n- Donations antérieures : ${currency(state.donationAnterieure)}\n- Abattement disponible par enfant : ${currency(state.abattementDisponible)}\n- Part taxable par enfant : ${currency(state.taxableParEnfant)}\n- Droits totaux estimés : ${currency(state.droitsTotal)}\n\n3) Coût global estimatif\n- Droits de donation : ${currency(state.droitsTotal)}\n- Frais fixes estimatifs : ${currency(FRAIS_FIXES)}\n- Coût total : ${currency(state.coutTotal)}\n\nDocument généré automatiquement à partir des données saisies.`;

  el.notePreview.textContent = text;
}

el.hasAnterieure.addEventListener("change", () => {
  el.anterieureField.classList.toggle("active", el.hasAnterieure.checked);
  compute();
});

[
  el.nbEnfants,
  el.abattement,
  el.montantAnterieure,
  el.dossierNom,
  el.situation,
  el.donor1Name,
  el.donor1Birth,
  el.donor2Name,
  el.donor2Birth,
].forEach((field) => {
  field.addEventListener("input", compute);
  field.addEventListener("change", compute);
});

el.addCommunBtn.addEventListener("click", () => createBienCard("commun"));
el.addPropreBtn.addEventListener("click", () => createBienCard("propre"));

el.generateBtn.addEventListener("click", () => {
  const state = compute();
  generateNote(state);
  window.print();
});

createBienCard("commun");
createBienCard("propre");
