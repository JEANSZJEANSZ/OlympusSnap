/** Cheeky oracle lines — gods, mortals, and the booth ritual. */
export const PYTHIA_QUOTES = Object.freeze([
	'Mortal! The muses await your portrait. Press Start to ascend…',
	'Zeus is watching. Smile like you stole his lightning.',
	'Olympus demands a likeness worthy of the gods — strike a pose!',
	'Even Athena needs a flattering angle. Chin up, hero.',
	'Aphrodite says: soft eyes, sharp jaw, zero apologies.',
	'Hermes travels light. You? Bring your whole mythic crew.',
	'Poseidon can’t flood this booth — but your glow-up can.',
	'Hades keeps receipts. Make a face he’ll remember.',
	'Dionysus already started the party. You’re fashionably late.',
	'The Fates spun three threads… one of them is this selfie.',
	'Mortal flesh, immortal frame. Choose wisely. Then click.',
	'Oracle tip: gods forgive bad hair. They never forgive blinking.',
	'Mount Olympus has Wi-Fi now. Upload your legend.',
	'Hera’s side-eye is loading. Outshine it.',
	'Ares wants war. We want one perfect group shot. Compromise.',
	'Artemis hunts the moon; you hunt the flattering light.',
	'Hephaestus forged iron. We forge pixel relics. Enter.',
	'Nike whispered: you already won — now look like it.',
	'The oracle sees… slightly left. And maybe a peace sign.',
	'Demeter grows wheat. You grow vibes. Harvest time.'
]);

/** @returns {string} */
export function randomPythiaQuote() {
	const i = Math.floor(Math.random() * PYTHIA_QUOTES.length);
	return PYTHIA_QUOTES[i] ?? PYTHIA_QUOTES[0];
}
