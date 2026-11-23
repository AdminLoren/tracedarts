window.COTA = window.COTA || {};

COTA.data = (function () {
  let charactersCache = null;
  let relationshipsCache = null;

  async function getCharacters() {
    if (charactersCache) return charactersCache;
    const res = await fetch("data/characters.json", { cache: "no-cache" });
    charactersCache = await res.json();
    return charactersCache;
  }

  async function getRelationships() {
    if (relationshipsCache) return relationshipsCache;
    const res = await fetch("data/relationships.json", { cache: "no-cache" });
    relationshipsCache = await res.json();
    return relationshipsCache;
  }

  function findCharacter(list, id) {
    return list.find((c) => c.id === id);
  }

  function findRelationship(list, idA, idB) {
    return list.find(
      (r) =>
        (r.pair[0] === idA && r.pair[1] === idB) ||
        (r.pair[0] === idB && r.pair[1] === idA)
    );
  }

  const RELATIONSHIP_COLORS = {
    Lovers: "#FF6FA5",
    Friends: "#4A90D9",
    "Close Friends": "#5DADE2",
    "Best Friends": "#2ECC71",
    Family: "#E74C3C",
    Cousins: "#E67E22",
    "Honorary Cousins": "#F5B041",
    "Half-\"Brothers\"": "#A0522D",
    Confidants: "#1ABC9C",
    Frenemies: "#C0392B",
    Acquaintances: "#95A5A6",
    "N/A": "#333333",
    Special: "#9B59B6",
  };

  return {
    getCharacters,
    getRelationships,
    findCharacter,
    findRelationship,
    RELATIONSHIP_COLORS,
  };
})();
