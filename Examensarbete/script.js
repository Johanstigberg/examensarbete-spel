// Globala variabler som kommer att fyllas med data
let allMonsterLists = [];
let bossLista = [];
let startPokemon = null; // Kommer att laddas från JSON

let tillgängligaMonster = [];
let aktuelltMonster = null;
let currentLevel = 0;

let playerPokemonTeam = [];
let activePlayerPokemon = null;

let gameWon = false;
let gameLost = false;
let monstersBesegradePåDennaNivå = 0;
const antalMonsterPerBoss = 3;

let isTurnInProgress = false;

// Referenser till DOM-element
const monsterImageContainer = document.querySelector(".monster-info .image-container");
const monsterInfoElements = document.querySelector(".monster-info");
const monsterImageElement = document.getElementById("monster-image");
const monsterNameElement = document.getElementById("monster-name");
const monsterHpElement = document.getElementById("monster-hp");

const playerImageElement = document.getElementById("player-image");
const playerNameElement = document.getElementById("player-name");
const playerHpElement = document.getElementById("player-hp");
const playerAttacksContainer = document.getElementById("player-attacks");
const pokeballIndicatorsContainer = document.getElementById("pokeball-indicators"); // NY REFERENS

let choiceDisplayElement = null;

// --- Funktion för att ladda speldata ---
async function loadGameData() {
    // För utveckling, rensa alltid localStorage för att säkerställa att senaste gameData.json används.
    // KOM IHÅG ATT TA BORT ELLER KOMMENTERA BORT DENNA RAD FÖRE PUBLIKATION!
    localStorage.clear();

    const storedData = localStorage.getItem('monsterGameData');
    if (storedData) {
        try {
            const data = JSON.parse(storedData);
            allMonsterLists = data.monsterLists;
            bossLista = data.bosses;
            startPokemon = data.startPokemon;
            console.log("Speldata laddad från localStorage!");
            initGame(); // Starta spelet
            return;
        } catch (e) {
            console.error("Fel vid parsning av data från localStorage:", e);
            // Om fel uppstår, fortsätt och ladda från filen
        }
    }

    // Om inte i localStorage, eller om fel uppstod, ladda från JSON-fil
    try {
        const response = await fetch('gameData.json'); // Se till att sökvägen är korrekt
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        allMonsterLists = data.monsterLists;
        bossLista = data.bosses;
        startPokemon = data.startPokemon;

        // Spara till localStorage för framtida bruk
        localStorage.setItem('monsterGameData', JSON.stringify(data));
        console.log("Speldata laddad från gameData.json och sparad till localStorage!");
        initGame(); // Starta spelet
    } catch (error) {
        console.error("Kunde inte ladda speldata:", error);
        // Hantera fel, t.ex. visa ett felmeddelande eller ladda en fallback
        alert("Kunde inte ladda spelet. Kontrollera att 'gameData.json' finns och är korrekt.");
    }
}

// Anropa loadGameData när sidan laddas
window.onload = loadGameData;


// --- Resten av din spellogik ---

function createAttackButtons() {
    playerAttacksContainer.innerHTML = "";
    if (!activePlayerPokemon) return;

    activePlayerPokemon.attacker.forEach((attack) => {
        const button = document.createElement("button");
        button.classList.add("attack-button");
        button.textContent = attack.uses !== undefined ? `${attack.namn} (${attack.uses}/${attack.maxUses || ''})` : attack.namn;
        button.disabled = isTurnInProgress || (attack.uses !== undefined && attack.uses <= 0);
        button.addEventListener("click", () => handlePlayerAttack(attack));
        playerAttacksContainer.appendChild(button);
    });
}

function handlePlayerAttack(attack) {
    if (gameWon || gameLost || isTurnInProgress || !activePlayerPokemon) {
        return;
    }

    if (attack.uses !== undefined) {
        if (attack.uses <= 0) {
            logMessage(`${activePlayerPokemon.namn}s ${attack.namn} har inga fler användningar kvar!`);
            return;
        }
        attack.uses--;
    }

    isTurnInProgress = true;
    disableAttackButtons(true);

    const damage = attack.damage;
    aktuelltMonster.hp -= damage;
    if (aktuelltMonster.hp < 0) aktuelltMonster.hp = 0;

    updateDisplay();

    logMessage(`${activePlayerPokemon.namn} använder ${attack.namn} och gör ${damage} skada!`);

    if (aktuelltMonster.hp <= 0) {
        logMessage(`${aktuelltMonster.namn} besegras!`);

        // Återställ HP för aktiv spelar-Pokémon
        if (activePlayerPokemon) {
            activePlayerPokemon.hp += 7; // Återställ 5 HP
            if (activePlayerPokemon.hp > (activePlayerPokemon.originalHp || activePlayerPokemon.hp)) { //
                activePlayerPokemon.hp = (activePlayerPokemon.originalHp || activePlayerPokemon.hp); //
            }
            logMessage(`${activePlayerPokemon.namn} återhämtar 5 HP!`); //
        }

        const currentBoss = bossLista[currentLevel];
        if (currentBoss && aktuelltMonster.namn === currentBoss.namn) {
            logMessage(`Du har fångat ${aktuelltMonster.namn} och den ansluter sig till ditt lag!`);
            const capturedPokemon = JSON.parse(JSON.stringify(aktuelltMonster));
            capturedPokemon.hp = capturedPokemon.originalHp || capturedPokemon.hp;
            if (capturedPokemon.attacker) {
                capturedPokemon.attacker.forEach(a => {
                    if (a.maxUses) a.uses = a.maxUses;
                });
            }
            playerPokemonTeam.push(capturedPokemon);
            logMessage(`Ditt lag har nu ${playerPokemonTeam.length} Pokémon!`);
            updatePokeballIndicators(); // ANROPA HÄR NÄR EN NY POKÉMON FÅNGAS

            currentLevel++;
            monstersBesegradePåDennaNivå = 0;

            if (currentLevel >= bossLista.length) {
                gameWon = true;
                setTimeout(() => {
                    window.location.href = 'win.html';
                    logMessage(`Grattis! Du har besegrat alla bossar och vunnit spelet!`);
                    isTurnInProgress = false;
                }, 1000);
                return;
            } else {
                logMessage(`Du går vidare till Nivå ${currentLevel + 1}!`);
            }
        } else {
            monstersBesegradePåDennaNivå++;
        }

        setTimeout(() => {
            handleNextEncounter();
        }, 1500);
    } else {
        setTimeout(() => monsterAttack(), 1000);
    }
}

function handleNextEncounter() {
    if (monstersBesegradePåDennaNivå >= antalMonsterPerBoss && currentLevel < bossLista.length) {
        aktuelltMonster = JSON.parse(JSON.stringify(bossLista[currentLevel]));
        aktuelltMonster.originalHp = aktuelltMonster.hp;
        logMessage(`En mäktig ${aktuelltMonster.namn} dyker upp! Gör dig redo för Nivå ${currentLevel + 1}s boss-strid!`);
    } else if (currentLevel < allMonsterLists.length) {
        if (tillgängligaMonster.length === 0) {
            tillgängligaMonster = JSON.parse(JSON.stringify(allMonsterLists[currentLevel]));
            logMessage(`Fyller på med monster för Nivå ${currentLevel + 1}.`);
        }
        aktuelltMonster = väljSlumpmässigtMonster();
        logMessage(`Nytt monster dyker upp!`);
    } else {
        logMessage("Inga fler monster att möta. Spelet borde vara vunnet.");
        gameWon = true;
        setTimeout(() => {
            window.location.href = 'win.html';
            isTurnInProgress = false;
        }, 1000);
        return;
    }

    updateMonsterName();
    updateMonsterImage();
    updateMaxMonsterHpDisplay(aktuelltMonster.hp);
    updateDisplay();
    isTurnInProgress = false;
    disableAttackButtons(false);
}

function monsterAttack() {
    if (gameWon || gameLost || !activePlayerPokemon) return;

    const monsterAttackUsed = aktuelltMonster.attacker[Math.floor(Math.random() * aktuelltMonster.attacker.length)];
    const monsterDamage = monsterAttackUsed.damage;

    activePlayerPokemon.hp -= monsterDamage;
    if (activePlayerPokemon.hp < 0) activePlayerPokemon.hp = 0;
    updateDisplay();
    logMessage(
        `${aktuelltMonster.namn} använder ${monsterAttackUsed.namn} och gör ${monsterDamage} skada!`
    );

    if (activePlayerPokemon.hp <= 0) {
        logMessage(`${activePlayerPokemon.namn} har blivit besegrad!`);
        const defeatedPokemonIndex = playerPokemonTeam.findIndex(p => p === activePlayerPokemon);
        if (defeatedPokemonIndex > -1) {
            playerPokemonTeam.splice(defeatedPokemonIndex, 1);
        }

        if (playerPokemonTeam.length === 0) {
            gameLost = true;
            setTimeout(() => {
                window.location.href = 'lose.html';
                logMessage(`Alla dina Pokémon är besegrade!`);
                isTurnInProgress = false;
            }, 1000);
        } else {
            activePlayerPokemon = playerPokemonTeam[0]; // Välj första Pokémon i laget
            logMessage(`Du skickar ut ${activePlayerPokemon.namn}!`);
            updatePlayerInfo(); // Denna anropar redan updatePokeballIndicators
            setTimeout(() => {
                isTurnInProgress = false;
                disableAttackButtons(false);
            }, 500);
        }
    } else {
        isTurnInProgress = false;
        disableAttackButtons(false);
    }
}

function updateMonsterName() {
    monsterNameElement.textContent = aktuelltMonster.namn;
    monsterNameElement.style.display = 'block';
}

function updateMonsterImage() {
    monsterImageElement.src = aktuelltMonster.bild;
    monsterImageElement.style.display = 'block';
    monsterImageContainer.style.display = 'block';
    monsterImageContainer.style.width = '150px';
    monsterImageContainer.style.height = '150px';
    monsterImageContainer.style.borderRadius = '50%';
    monsterImageContainer.style.overflow = 'hidden';
    monsterImageContainer.style.margin = '0 auto 10px auto';
}

function updateMaxMonsterHpDisplay(maxHp) {
    const maxMonsterHpElement = document.getElementById("max-monster-hp");
    maxMonsterHpElement.textContent = maxHp;
    monsterHpElement.style.display = 'block';
}

// NY FUNKTION: Uppdatera Pokeball-indikatorerna
function updatePokeballIndicators() {
    pokeballIndicatorsContainer.innerHTML = ''; // Rensa befintliga Pokeballs

    // Rita ut en Pokeball för varje Pokémon i laget
    const remainingPokemonCount = playerPokemonTeam.length; //

    for (let i = 0; i < remainingPokemonCount; i++) { //
        const pokeballImg = document.createElement('img'); //
        pokeballImg.src = 'bilder/Pokeball.png'; // Se till att sökvägen är korrekt!
        pokeballImg.alt = 'Pokeball'; //
        pokeballImg.classList.add('pokeball-icon'); //
        pokeballIndicatorsContainer.appendChild(pokeballImg); //
    }
}


function updatePlayerInfo() {
    if (!activePlayerPokemon) {
        playerNameElement.textContent = "Ingen Pokémon";
        playerImageElement.src = "";
        document.getElementById("current-player-hp").textContent = "0";
        document.getElementById("max-player-hp").textContent = "0";
        playerImageElement.style.display = 'none';
        playerAttacksContainer.innerHTML = "";
        pokeballIndicatorsContainer.innerHTML = ""; // Rensa Pokeballs om ingen Pokémon kvar
        return;
    }

    playerNameElement.textContent = activePlayerPokemon.namn;
    playerImageElement.src = activePlayerPokemon.bild;
    document.getElementById("current-player-hp").textContent = activePlayerPokemon.hp;
    document.getElementById("max-player-hp").textContent = activePlayerPokemon.originalHp || activePlayerPokemon.hp;
    playerImageElement.style.display = 'block';

    createAttackButtons();
    updatePokeballIndicators(); // ANROPA HÄR
}

function updateDisplay() {
    updatePlayerInfo();
    document.getElementById("current-monster-hp").textContent = aktuelltMonster.hp;
}

function logMessage(message) {
    const logList = document.getElementById("log-messages");
    const listItem = document.createElement("li");
    listItem.textContent = message;
    logList.insertBefore(listItem, logList.firstChild);
    while (logList.children.length > 10) {
        logList.removeChild(logList.lastChild);
    }
    logList.scrollTop = 0;
}

function väljSlumpmässigtMonster() {
    if (tillgängligaMonster.length === 0) {
        if (currentLevel < allMonsterLists.length) {
            tillgängligaMonster = JSON.parse(JSON.stringify(allMonsterLists[currentLevel]));
            logMessage(`Fyller på med monster för Nivå ${currentLevel + 1}.`);
        } else {
            return null;
        }
    }

    const randomIndex = Math.floor(Math.random() * tillgängligaMonster.length);
    const valtMonster = tillgängligaMonster[randomIndex];
    const monsterForBattle = { ...valtMonster, originalHp: valtMonster.hp };
    tillgängligaMonster.splice(randomIndex, 1);
    return monsterForBattle;
}

function disableAttackButtons(disable) {
    const buttons = playerAttacksContainer.querySelectorAll('.attack-button');
    buttons.forEach(button => {
        const attackName = button.textContent.split(' ')[0];
        const attack = activePlayerPokemon.attacker.find(a => a.namn === attackName);
        button.disabled = disable || (attack && attack.uses !== undefined && attack.uses <= 0);
    });
}

function initGame() {
    tillgängligaMonster = [];
    currentLevel = 0;
    monstersBesegradePåDennaNivå = 0;
    gameWon = false;
    gameLost = false;
    isTurnInProgress = false;

    playerPokemonTeam = [{ ...startPokemon }];
    activePlayerPokemon = playerPokemonTeam[0];

    playerPokemonTeam.forEach(p => {
        if (p.attacker) {
            p.attacker.forEach(a => {
                if (a.maxUses) a.uses = a.maxUses;
            });
        }
    });

    if (choiceDisplayElement && choiceDisplayElement.parentNode) {
        choiceDisplayElement.parentNode.removeChild(choiceDisplayElement);
        choiceDisplayElement = null;
    }

    monsterInfoElements.innerHTML = '';
    monsterInfoElements.appendChild(monsterImageContainer);
    monsterInfoElements.appendChild(monsterNameElement);
    monsterInfoElements.appendChild(monsterHpElement);

    handleNextEncounter(); // Ladda första monstret/bossen

    logMessage(`Välkommen, tränare! Din ${activePlayerPokemon.namn} är redo för Nivå ${currentLevel + 1}!`);
    disableAttackButtons(false);
    updatePokeballIndicators(); // ANROPA HÄR FÖR FÖRSTA VISNINGEN
}