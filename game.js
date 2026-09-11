const tg = window.Telegram.WebApp;
tg.expand(); 
tg.ready();

// Базовые статы (если игрок зашел в первый раз)
let game = {
    bytes: 0,
    clickPower: 1,
    energy: 1000,
    maxEnergy: 1000,
    energyRegen: 2,   
    passiveIncome: 0, 
    critChance: 0.0   
};

let costs = {
    click: 50,
    energy: 150,
    regen: 200,
    passive: 300,
    crit: 500
};

const scoreEl = document.getElementById('score');
const energyTextEl = document.getElementById('energy-text');
const energyFillEl = document.getElementById('energy-fill');
const coreEl = document.getElementById('core');
const gameZone = document.getElementById('game-zone');

// ==========================================
// СИСТЕМА СОХРАНЕНИЙ (CloudStorage / LocalStorage)
// ==========================================

// Применяем загруженные данные
function applySaveData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        // Сливаем базовые переменные и загруженные (защита от багов при обновах)
        game = { ...game, ...data.game };
        costs = { ...costs, ...data.costs };
        
        // Обновляем цены в терминале
        document.getElementById('cost-click').innerText = costs.click;
        document.getElementById('cost-energy').innerText = costs.energy;
        document.getElementById('cost-regen').innerText = costs.regen;
        document.getElementById('cost-passive').innerText = costs.passive;
        document.getElementById('cost-crit').innerText = costs.crit;
    } catch (e) {
        console.error("Ошибка чтения сохранения");
    }
}

// Загрузка игры
function loadGame(callback) {
    // Если запущено внутри Telegram
    if (tg.CloudStorage) {
        tg.CloudStorage.getItem('crimson_save', (error, value) => {
            if (!error && value) applySaveData(value);
            if (callback) callback(); // Запускаем игру после загрузки
        });
    } 
    // Если запущено просто в браузере (для тестов)
    else {
        const value = localStorage.getItem('crimson_save');
        if (value) applySaveData(value);
        if (callback) callback();
    }
}

// Сохранение игры
window.saveGame = function() {
    const saveData = JSON.stringify({ game, costs });
    
    if (tg.CloudStorage) {
        tg.CloudStorage.setItem('crimson_save', saveData);
    } else {
        localStorage.setItem('crimson_save', saveData);
    }
}

// ==========================================
// ЛОГИКА ИГРЫ
// ==========================================

window.toggleMenu = function(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.toggle('hidden');
    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

coreEl.addEventListener('pointerdown', (e) => {
    const energyCost = 5;

    if (game.energy >= energyCost) {
        game.energy -= energyCost;
        
        const isCrit = Math.random() < game.critChance;
        const damage = isCrit ? game.clickPower * 5 : game.clickPower;
        
        game.bytes += damage;
        
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred(isCrit ? 'heavy' : 'light');

        spawnFloatingNumber(e.clientX, e.clientY, damage, isCrit);
        updateUI();
    } else {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        coreEl.style.transform = 'translateX(-5px)';
        setTimeout(() => coreEl.style.transform = 'translateX(5px)', 50);
        setTimeout(() => coreEl.style.transform = 'translateX(0)', 100);
    }
});

function spawnFloatingNumber(x, y, amount, isCrit) {
    const floatEl = document.createElement('div');
    floatEl.className = 'floating-number';
    if (isCrit) floatEl.classList.add('crit');
    floatEl.innerText = isCrit ? `КРИТ! +${amount}` : `+${amount}`;
    
    floatEl.style.left = `${x - 20}px`;
    floatEl.style.top = `${y - 20}px`;
    
    gameZone.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 800);
}

window.buyUpgrade = function(type) {
    if (game.bytes >= costs[type]) {
        game.bytes -= costs[type];

        switch(type) {
            case 'click': game.clickPower += 1; break;
            case 'energy': game.maxEnergy += 500; break;
            case 'regen': game.energyRegen += 1; break;
            case 'passive': game.passiveIncome += 2; break;
            case 'crit': 
                game.critChance += 0.05; 
                if (game.critChance > 0.5) game.critChance = 0.5;
                break;
        }

        const multiplier = (type === 'crit' || type === 'passive') ? 1.8 : 1.5;
        costs[type] = Math.floor(costs[type] * multiplier);
        document.getElementById(`cost-${type}`).innerText = costs[type];

        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('heavy');
        updateUI();
        
        // Принудительно сохраняем игру после любой покупки
        saveGame();
    } else {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
    }
}

function updateUI() {
    scoreEl.innerText = Math.floor(game.bytes);
    energyTextEl.innerText = `${Math.floor(game.energy)} / ${game.maxEnergy} ⚡`;
    
    const energyPercent = (game.energy / game.maxEnergy) * 100;
    energyFillEl.style.width = `${energyPercent}%`;
}

// ==========================================
// ИНИЦИАЛИЗАЦИЯ И ИГРОВОЙ ЦИКЛ
// ==========================================

// Сначала загружаем данные, потом запускаем цикл
loadGame(() => {
    updateUI(); // Обновляем экран после загрузки

    // Главный игровой цикл
    setInterval(() => {
        if (game.passiveIncome > 0) {
            game.bytes += (game.passiveIncome / 10);
        }

        if (game.energy < game.maxEnergy) {
            game.energy += (game.energyRegen / 10);
            if (game.energy > game.maxEnergy) game.energy = game.maxEnergy;
        }
        
        updateUI();
    }, 100);

    // Автосохранение каждые 15 секунд
    setInterval(saveGame, 15000);
});