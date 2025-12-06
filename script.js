/* ===========================
   CONFIG (your Firebase settings)
   =========================== */
const firebaseConfig = {
  apiKey: "AIzaSyDFb8wY6B_aJ-AM-ljmLMl-OH-0zX6dTMU",
  authDomain: "airqualitymonitoringsyst-eb5af.firebaseapp.com",
  databaseURL: "https://airqualitymonitoringsyst-eb5af-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "airqualitymonitoringsyst-eb5af",
  storageBucket: "airqualitymonitoringsyst-eb5af.firebasestorage.app",
  messagingSenderId: "219453815068",
  appId: "1:219453815068:web:529acf1f61f4e2624e62d9"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* DB paths (keep these as your senders currently push there) */
const PATH_HISTORY_FN = "/history/furfuri_nagar";
const PATH_HISTORY_DH = "/history/dholakpur";
const PATH_CMD = "/commands"; // used to send test_buzzer commands

/* UI elements */
const connBadge = document.getElementById('conn-badge');
const btnRefresh = document.getElementById('btn-refresh');
const btn1Min = document.getElementById('btn-1min');
const btnBuzzer = document.getElementById('btn-buzzer');
const btnExport = document.getElementById('btn-export');
const btnDeveloper = document.getElementById('btn-developer');
const themeSelect = document.getElementById('theme-select');
const themeOptions = document.querySelectorAll('.theme-option');
const refreshIndicator = document.getElementById('refresh-indicator');
const refreshCountdown = document.getElementById('refresh-countdown');

/* settings */
const MAX_RECORDS = 10;
const POLL_MS = 5000; // 5 seconds
const NOTIF_TIMEOUT = 6500;
const SENSOR_TIMEOUT = 120000; // 2 minutes - consider sensor inactive if no data for 2 minutes

/* thresholds (same as previously recommended but central here) */
const THRESH = {
  temp: { min: 10, max: 30 },
  humidity: { min: 20, max: 80 },
  aqi: { min: 0, max: 150 },
  smoke: { min: 0, max: 300 },
  co: { min: 0, max: 200 }
};

/* in-memory arrays (newest first) */
const last10 = { fn: [], dh: [] };
const lastMinuteAlerts = []; // store alerts for 1-minute modal

/* notification slot states */
const notifState = { fn: null, dh: null };

/* sensor status tracking */
const sensorStatus = {
  fn: { lastUpdate: null, active: false },
  dh: { lastUpdate: null, active: false }
};

/* helper formatting */
function fmt(n, digits=1){ if (n===null||n===undefined||isNaN(n)) return "--"; return Number(n).toFixed(digits) }
function nowStr(){ return new Date().toLocaleTimeString() }

/* ===========================
   Auto-refresh countdown
   =========================== */
let countdown = 5;
function startCountdown() {
  countdown = 5;
  const countdownInterval = setInterval(() => {
    countdown--;
    refreshCountdown.textContent = countdown;
    
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      refreshIndicator.classList.add('active');
      setTimeout(() => {
        manualPull();
        refreshIndicator.classList.remove('active');
        startCountdown();
      }, 500);
    }
  }, 1000);
}

/* ===========================
   Update sensor status
   =========================== */
function updateSensorStatus(cityKey) {
  const now = Date.now();
  const sensor = sensorStatus[cityKey];
  const sensorDot = document.getElementById(`${cityKey}-sensor-dot`);
  const sensorStatusText = document.getElementById(`${cityKey}-sensor-status`);
  const lastUpdateText = document.getElementById(`${cityKey}-last-update`);
  
  // Check if we've received data recently (within SENSOR_TIMEOUT)
  const isActive = sensor.lastUpdate && (now - sensor.lastUpdate) < SENSOR_TIMEOUT;
  
  if (isActive !== sensor.active) {
    sensor.active = isActive;
    
    if (isActive) {
      sensorDot.className = 'sensor-dot sensor-active';
      sensorStatusText.textContent = 'Active';
      sensorStatusText.style.color = 'var(--good)';
    } else {
      sensorDot.className = 'sensor-dot sensor-inactive';
      sensorStatusText.textContent = 'Inactive';
      sensorStatusText.style.color = 'var(--bad)';
    }
  }
  
  // Update last update time
  if (sensor.lastUpdate) {
    const lastUpdate = new Date(sensor.lastUpdate);
    lastUpdateText.textContent = `Last update: ${lastUpdate.toLocaleTimeString()}`;
  } else {
    lastUpdateText.textContent = 'Last update: --';
  }
}

// Periodically check sensor status
setInterval(() => {
  updateSensorStatus('fn');
  updateSensorStatus('dh');
}, 5000);

/* ===========================
   Developer Profile Setup
   =========================== */
function setupDeveloperProfile() {
  // Developer information
  const developerInfo = {
    name: "MR. Chaule",
    qualification: "BIT(Bachelor of Information Technology) Student & IoT Specialist",
    location: "Nepal",
    photo: "me_ai_3.png", // You can replace this with your photo filename
    socialLinks: {
      github: "https://github.com/Sajalchaulagin",
      linkedin: "https://www.linkedin.com/in/sajal-chaulagain",
      instagram: "https://www.instagram.com/chaulagain.sajal/",
      facebook: "https://www.facebook.com/sajal.chaulagain.5"
    }
  };

  // Set developer information
  document.getElementById('developer-name').textContent = developerInfo.name;
  document.getElementById('developer-qualification').textContent = developerInfo.qualification;
  document.getElementById('developer-location').textContent = developerInfo.location;
  document.getElementById('developer-photo').src = developerInfo.photo;

  // Set social links
  document.getElementById('github-link').href = developerInfo.socialLinks.github;
  document.getElementById('linkedin-link').href = developerInfo.socialLinks.linkedin;
  document.getElementById('instagram-link').href = developerInfo.socialLinks.instagram;
  document.getElementById('facebook-link').href = developerInfo.socialLinks.facebook;
}

// Initialize developer profile when page loads
setupDeveloperProfile();

/* ===========================
   Sparkline / Chart functions
   =========================== */
function drawSpark(canvas, values){
  if (!canvas) return;
  const ctx = canvas.getContext('2d'); const w = canvas.clientWidth; const h = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr; canvas.height = h * dpr; ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,w,h);
  if (!values || values.length === 0) return;
  const max = Math.max(...values), min = Math.min(...values);
  const range = (max - min) || 1;
  ctx.beginPath();
  values.forEach((v,i) => {
    const x = (i/(values.length-1 || 1))*(w-6)+3;
    const y = h - ((v - min)/range)*(h-6) - 3;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.strokeStyle = "var(--accent)"; ctx.lineWidth=2; ctx.stroke();
  const last = values[values.length-1];
  const lx = w-6; const ly = h - ((last-min)/range)*(h-6) - 3;
  ctx.beginPath(); ctx.fillStyle = "var(--accent)"; ctx.arc(lx,ly,3,0,Math.PI*2); ctx.fill();
}

/* ===========================
   Notification single-slot
   =========================== */
function showNotification(cityKey, title, message, level="info"){
  const slotId = cityKey === 'fn' ? 'fn-notif' : 'dh-notif';
  const titleElId = cityKey === 'fn' ? 'fn-notif-title' : 'dh-notif-title';
  const timeElId = cityKey === 'fn' ? 'fn-notif-time' : 'dh-notif-time';
  const slot = document.getElementById(slotId);
  const titleEl = document.getElementById(titleElId);
  const timeEl = document.getElementById(timeElId);

  titleEl.innerHTML = `<span style="display:block">${title}</span><small style="color:var(--muted);font-weight:400">${message}</small>`;
  timeEl.textContent = nowStr();

  // border color by level
  slot.style.borderLeftColor = level === 'danger' ? 'var(--bad)' : (level === 'warn' ? 'var(--warn)' : 'var(--accent-2)');
  slot.classList.add('show');

  if (notifState[cityKey] && notifState[cityKey].timeout) clearTimeout(notifState[cityKey].timeout);

  notifState[cityKey] = {
    timeout: setTimeout(()=> {
      slot.classList.remove('show');
      notifState[cityKey] = null;
    }, NOTIF_TIMEOUT)
  };
}

/* ===========================
   Update top card (latest)
   =========================== */
function refreshTopCard(cityKey, latest){
  if (!latest) return;
  const updatedTime = new Date().toLocaleTimeString();
  
  // Update sensor last update time
  sensorStatus[cityKey].lastUpdate = Date.now();
  updateSensorStatus(cityKey);
  
  if (cityKey === 'fn'){
    document.getElementById('fn-time').textContent = latest.time_str || nowStr();
    document.getElementById('fn-temp').textContent = (latest.temp_c !== undefined ? fmt(latest.temp_c) : '--') + " °C";
    document.getElementById('fn-hum').textContent = (latest.humidity_percent !== undefined ? fmt(latest.humidity_percent) : '--') + " %";
    document.getElementById('fn-heat').textContent = (latest.heat_index_c !== undefined ? fmt(latest.heat_index_c) : '--') + " °C";
    document.getElementById('fn-aqi').textContent = (latest.aqi_index !== undefined ? fmt(latest.aqi_index,0) : '--');
    document.getElementById('fn-co').textContent = (latest.co_ppm !== undefined ? fmt(latest.co_ppm,0) + ' ppm' : '--');
    document.getElementById('fn-dust').textContent = (latest.smoke_ppm !== undefined ? fmt(latest.smoke_ppm,0) + ' ppm' : '--');
    document.getElementById('fn-mq135').textContent = (latest.aqi_index !== undefined ? fmt(latest.aqi_index,0) : '--');
    document.getElementById('fn-updated').textContent = `Updated: ${updatedTime}`;

    const pill = document.getElementById('fn-status');
    const aqi = Number(latest.aqi_index || 0);
    if (isNaN(aqi)) { pill.className='status-pill status-good'; pill.textContent='Unknown'; }
    else if (aqi <= 50) { pill.className='status-pill status-good'; pill.textContent='Good'; }
    else if (aqi <= 150) { pill.className='status-pill status-warn'; pill.textContent='Moderate'; }
    else { pill.className='status-pill status-bad'; pill.textContent='Poor'; }
  } else {
    document.getElementById('dh-time').textContent = latest.time_str || nowStr();
    document.getElementById('dh-temp').textContent = (latest.temp_c !== undefined ? fmt(latest.temp_c) : '--') + " °C";
    document.getElementById('dh-hum').textContent = (latest.humidity_percent !== undefined ? fmt(latest.humidity_percent) : '--') + " %";
    document.getElementById('dh-heat').textContent = (latest.heat_index_c !== undefined ? fmt(latest.heat_index_c) : '--') + " °C";
    document.getElementById('dh-aqi').textContent = (latest.aqi_index !== undefined ? fmt(latest.aqi_index,0) : '--');
    document.getElementById('dh-dust').textContent = (latest.smoke_ppm !== undefined ? fmt(latest.smoke_ppm,0) + ' ppm' : '--');
    document.getElementById('dh-updated').textContent = `Updated: ${updatedTime}`;

    const pill = document.getElementById('dh-status');
    const aqi = Number(latest.aqi_index || 0);
    if (isNaN(aqi)) { pill.className='status-pill status-good'; pill.textContent='Unknown'; }
    else if (aqi <= 50) { pill.className='status-pill status-good'; pill.textContent='Good'; }
    else if (aqi <= 150) { pill.className='status-pill status-warn'; pill.textContent='Moderate'; }
    else { pill.className='status-pill status-bad'; pill.textContent='Poor'; }
  }
  
  // Update summary stats
  updateSummaryStats();
}

/* ===========================
   Update Summary Stats
   =========================== */
function updateSummaryStats() {
  // Calculate averages
  let tempSum = 0, humSum = 0, aqiSum = 0;
  let tempCount = 0, humCount = 0, aqiCount = 0;
  
  // Process Furfuri Nagar data
  last10.fn.forEach(record => {
    if (record.temp_c !== undefined && !isNaN(record.temp_c)) {
      tempSum += Number(record.temp_c);
      tempCount++;
    }
    if (record.humidity_percent !== undefined && !isNaN(record.humidity_percent)) {
      humSum += Number(record.humidity_percent);
      humCount++;
    }
    if (record.aqi_index !== undefined && !isNaN(record.aqi_index)) {
      aqiSum += Number(record.aqi_index);
      aqiCount++;
    }
  });
  
  // Process Dholakpur data
  last10.dh.forEach(record => {
    if (record.temp_c !== undefined && !isNaN(record.temp_c)) {
      tempSum += Number(record.temp_c);
      tempCount++;
    }
    if (record.humidity_percent !== undefined && !isNaN(record.humidity_percent)) {
      humSum += Number(record.humidity_percent);
      humCount++;
    }
    if (record.aqi_index !== undefined && !isNaN(record.aqi_index)) {
      aqiSum += Number(record.aqi_index);
      aqiCount++;
    }
  });
  
  // Update UI
  document.getElementById('avg-temp').textContent = tempCount > 0 ? fmt(tempSum / tempCount) + " °C" : "-- °C";
  document.getElementById('avg-hum').textContent = humCount > 0 ? fmt(humSum / humCount) + " %" : "-- %";
  document.getElementById('avg-aqi').textContent = aqiCount > 0 ? fmt(aqiSum / aqiCount, 0) : "--";
  
  // Update alert count (last minute)
  const minuteAgo = Math.floor(Date.now()/1000) - 60;
  const recentAlerts = lastMinuteAlerts.filter(alert => alert.ts >= minuteAgo).length;
  document.getElementById('alert-count').textContent = recentAlerts;
}

/* ===========================
   History rendering with smooth insert (no blinking)
   =========================== */
function createHistNode(rec, isNew=false){
  const wrapper = document.createElement('div');
  wrapper.className = 'hist-item' + (isNew ? ' new' : '');
  wrapper.dataset.ts = rec.timestamp || 0;

  const left = document.createElement('div'); left.className='left';
  const time = document.createElement('div'); time.className='time'; time.textContent = rec.time_str || new Date((rec.timestamp||0)*1000).toLocaleTimeString();
  const title = document.createElement('div'); title.innerHTML = `<strong>${rec.location || ''}</strong> • T: ${rec.temp_c !== undefined ? fmt(rec.temp_c)+'°C' : '--'} • AQI: ${rec.aqi_index !== undefined ? fmt(rec.aqi_index,0) : '--'}`;
  const small = document.createElement('small'); small.style.color='var(--muted)'; small.textContent = `${rec.humidity_percent !== undefined ? 'H: '+fmt(rec.humidity_percent)+'%' : ''}${rec.smoke_ppm ? ' • Smoke: '+fmt(rec.smoke_ppm,0)+' ppm' : ''}${rec.co_ppm ? ' • CO: '+fmt(rec.co_ppm,0)+' ppm' : ''}`;
  left.appendChild(time); left.appendChild(title); left.appendChild(small);

  const canvas = document.createElement('canvas'); canvas.className='spark';
  wrapper.appendChild(left); wrapper.appendChild(canvas);
  return wrapper;
}

function drawSparklinesForContainer(container, arr){
  const temps = arr.map(r => (r.temp_c !== undefined ? Number(r.temp_c) : 0)).slice().reverse(); // oldest->newest
  const canvases = container.querySelectorAll('canvas.spark');
  canvases.forEach((cv, idx) => { drawSpark(cv, temps); });
}

function renderHistorySmooth(cityKey, arr){
  const containerId = cityKey === 'fn' ? 'fn-history' : 'dh-history';
  const container = document.getElementById(containerId);
  if (container.children.length === 1 && container.children[0].classList.contains('small')) container.innerHTML = '';

  const existing = Array.from(container.children);
  const existingTimestamps = existing.map(ch => ch.dataset?.ts ? Number(ch.dataset.ts) : null);

  if (existing.length === 0){
    arr.forEach((rec, idx) => container.appendChild(createHistNode(rec, idx===0)));
    drawSparklinesForContainer(container, arr);
    return;
  }

  const topExistingTs = existingTimestamps[0];
  if (arr.length>0 && arr[0].timestamp !== topExistingTs){
    const newNode = createHistNode(arr[0], true);
    container.insertBefore(newNode, container.firstChild);
    if (container.children[1]) container.children[1].classList.remove('new');
    while (container.children.length > MAX_RECORDS) container.removeChild(container.lastChild);
    drawSparklinesForContainer(container, arr);
    return;
  }

  if (container.children.length !== arr.length){
    container.innerHTML = '';
    arr.forEach((rec, idx)=> container.appendChild(createHistNode(rec, idx===0)));
    drawSparklinesForContainer(container, arr);
  }
}

/* insert new record into memory and UI */
function insertNewRecord(cityKey, record){
  const arr = last10[cityKey];
  if (arr.length>0 && record.timestamp === arr[0].timestamp) return;
  arr.unshift(record);
  if (arr.length > MAX_RECORDS) arr.pop();
  refreshTopCard(cityKey, arr[0]);
  renderHistorySmooth(cityKey, arr);
  checkAlerts(cityKey, record);
}

/* ===========================
   Alert logic
   =========================== */
function checkAlerts(cityKey, rec){
  let level = null, title = null, message = null;
  if (rec.temp_c !== undefined){
    if (rec.temp_c >= THRESH.temp.max){ level='danger'; title='Temperature Too High'; message=`${fmt(rec.temp_c)}°C — stay hydrated!`; }
    else if (rec.temp_c <= THRESH.temp.min){ level='warn'; title='Temperature Too Low'; message=`${fmt(rec.temp_c)}°C — bundle up!`; }
  }
  if (!level && rec.aqi_index !== undefined){
    if (rec.aqi_index >= THRESH.aqi.max){ level='danger'; title='AQI Critical'; message=`AQI ${fmt(rec.aqi_index,0)} — avoid outdoors`; }
    else if (rec.aqi_index >= 80){ level='warn'; title='AQI Moderate'; message=`AQI ${fmt(rec.aqi_index,0)} — be careful`; }
  }
  if (!level && rec.smoke_ppm !== undefined && rec.smoke_ppm >= THRESH.smoke.max){ level='danger'; title='Smoke Alert'; message=`Smoke ~ ${fmt(rec.smoke_ppm,0)} ppm`; }
  if (!level && rec.co_ppm !== undefined && rec.co_ppm >= THRESH.co.max){ level='danger'; title='CO Alert'; message=`CO ~ ${fmt(rec.co_ppm,0)} ppm`; }

  if (level){
    // show single-slot notification replacing old one
    showNotification(cityKey, title, message, level);
    // push to lastMinuteAlerts array for the modal
    lastMinuteAlerts.push({ city: cityKey, ts: rec.timestamp || Math.floor(Date.now()/1000), title, message, level, record: rec });
    // also trim older than 70 seconds
    const cutoff = Math.floor(Date.now()/1000) - 70;
    while (lastMinuteAlerts.length && lastMinuteAlerts[0].ts < cutoff) lastMinuteAlerts.shift();
  }
}

/* ===========================
   Firebase listeners and syncronization
   =========================== */
function onHistorySnapshot(cityKey, snapshot){
  if (!snapshot.exists()) return;
  const arr = [];
  snapshot.forEach(ch => {
    const v = ch.val();
    if (!v.timestamp && v.time_str) v.timestamp = Math.floor(Date.now()/1000);
    arr.push(v);
  });
  arr.sort((a,b)=> b.timestamp - a.timestamp);
  if (last10[cityKey].length === 0){
    last10[cityKey] = arr.slice(0,MAX_RECORDS);
    refreshTopCard(cityKey, last10[cityKey][0]);
    renderHistorySmooth(cityKey, last10[cityKey]);
  } else {
    if (arr.length>0 && arr[0].timestamp && arr[0].timestamp !== last10[cityKey][0]?.timestamp){
      insertNewRecord(cityKey, arr[0]);
    }
    const serverTimestamps = arr.map(x=>x.timestamp);
    const localTimestamps = last10[cityKey].map(x=>x.timestamp);
    if (JSON.stringify(serverTimestamps) !== JSON.stringify(localTimestamps)){
      last10[cityKey] = arr.slice(0, MAX_RECORDS);
      refreshTopCard(cityKey, last10[cityKey][0]);
      renderHistorySmooth(cityKey, last10[cityKey]);
    }
  }
}

function attachListeners(){
  db.ref(PATH_HISTORY_FN).orderByChild('timestamp').limitToLast(MAX_RECORDS)
    .on('value', snap => onHistorySnapshot('fn', snap), err => console.error('FN listen err', err));
  db.ref(PATH_HISTORY_DH).orderByChild('timestamp').limitToLast(MAX_RECORDS)
    .on('value', snap => onHistorySnapshot('dh', snap), err => console.error('DH listen err', err));
}

/* initial fetch */
function manualPull(){
  db.ref(PATH_HISTORY_FN).orderByChild('timestamp').limitToLast(MAX_RECORDS).once('value').then(snap => onHistorySnapshot('fn', snap));
  db.ref(PATH_HISTORY_DH).orderByChild('timestamp').limitToLast(MAX_RECORDS).once('value').then(snap => onHistorySnapshot('dh', snap));
  
  // Update last updated time
  document.getElementById('last-updated').textContent = new Date().toLocaleString();
}

/* connection indicator */
db.ref('.info/connected').on('value', s => {
  const el = document.getElementById('conn-badge');
  if (s.val() === true) {
    el.innerHTML = '<i class="fas fa-wifi"></i> Connected (Realtime)';
    el.classList.remove('disconnected');
    el.classList.add('connected');
  } else {
    el.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Disconnected';
    el.classList.remove('connected');
    el.classList.add('disconnected');
  }
});

/* wire up buttons */
btnRefresh.addEventListener('click', ()=> {
  btnRefresh.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';
  manualPull();
  setTimeout(() => {
    btnRefresh.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
  }, 1000);
});

btn1Min.addEventListener('click', showLastMinuteModal);
document.getElementById('close-modal').addEventListener('click', ()=> document.getElementById('modal').style.display = 'none');

/* Test buzzer: writes to /commands/test_buzzer with timestamp and source */
btnBuzzer.addEventListener('click', async ()=>{
  try {
    const payload = { cmd: "test_buzzer", source: "dashboard", timestamp: Math.floor(Date.now()/1000) };
    await db.ref(PATH_CMD + '/test_buzzer').set(payload);
    // visual feedback
    showNotification('fn', 'Buzzer Test', 'Test command sent to hardware', 'info');
    setTimeout(() => {
      showNotification('dh', 'Buzzer Test', 'Test command sent to hardware', 'info');
    }, 500);
  } catch (e) {
    alert('Failed to write test command: ' + e.message);
  }
});

/* Export Data */
btnExport.addEventListener('click', () => {
  const data = {
    furfuri_nagar: last10.fn,
    dholakpur: last10.dh,
    exported_at: new Date().toISOString()
  };
  
  const dataStr = JSON.stringify(data, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `air_quality_data_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showNotification('fn', 'Data Exported', 'JSON file downloaded successfully', 'info');
});

/* Developer button - scroll to developer section */
btnDeveloper.addEventListener('click', () => {
  document.querySelector('.developer-profile').scrollIntoView({ 
    behavior: 'smooth' 
  });
});

/* ===========================
   Theme Switching
   =========================== */
function setTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('dashboard-theme', themeName);
  
  // Update theme select dropdown
  themeSelect.value = themeName;
  
  // Update active theme option
  themeOptions.forEach(option => {
    if (option.dataset.theme === themeName) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
}

// Theme select change
themeSelect.addEventListener('change', (e)=>{
  setTheme(e.target.value);
});

// Theme option clicks
themeOptions.forEach(option => {
  option.addEventListener('click', () => {
    setTheme(option.dataset.theme);
  });
});

// Load saved theme
const savedTheme = localStorage.getItem('dashboard-theme') || 'stylish';
setTheme(savedTheme);

/* ===========================
   Modal: show last 1 minute
   =========================== */
const modal = document.getElementById('modal');
async function showLastMinuteModal(){
  modal.style.display = 'flex';
  const sec60 = Math.floor(Date.now()/1000) - 60;
  const out = [];
  const [sfn, sdh] = await Promise.all([
    db.ref(PATH_HISTORY_FN).orderByChild('timestamp').startAt(sec60).once('value'),
    db.ref(PATH_HISTORY_DH).orderByChild('timestamp').startAt(sec60).once('value')
  ]);
  if (sfn.exists()) sfn.forEach(ch => out.push(ch.val()));
  if (sdh.exists()) sdh.forEach(ch => out.push(ch.val()));
  out.sort((a,b)=>b.timestamp - a.timestamp);
  const html = out.length === 0 ? '<div class="small" style="padding:12px;color:var(--muted)">No readings in last 1 minute.</div>'
    : out.map(o => `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.03);">
        <div style="display:flex;justify-content:space-between"><strong>${o.location || ''}</strong><span style="color:var(--muted)">${o.time_str || new Date(o.timestamp*1000).toLocaleTimeString()}</span></div>
        <div class="small" style="margin-top:6px;color:var(--muted)">T: ${o.temp_c!==undefined?fmt(o.temp_c)+'°C':'--'} • H: ${o.humidity_percent!==undefined?fmt(o.humidity_percent)+'%':'--'} • AQI: ${o.aqi_index!==undefined?fmt(o.aqi_index,0):'--'}${o.co_ppm? ' • CO: '+fmt(o.co_ppm,0)+' ppm':''}${o.smoke_ppm? ' • Smoke: '+fmt(o.smoke_ppm,0)+' ppm':''}</div>
      </div>`).join('');
  document.getElementById('modal-content').innerHTML = html;
}

/* ===========================
   Start realtime listeners + initial manual pull
   =========================== */
function start(){
  attachListeners();
  manualPull();
  // Start auto-refresh countdown
  startCountdown();
  
  // Set up interval for manual pull (backup to realtime listeners)
  setInterval(() => manualPull(), POLL_MS);
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

/* ===========================
   Final small UX niceties
   =========================== */
document.addEventListener('visibilitychange', ()=> {
  if (!document.hidden) manualPull();
});

/* End of script */