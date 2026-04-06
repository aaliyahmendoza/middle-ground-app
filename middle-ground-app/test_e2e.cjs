const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'test_screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
const delay = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  console.log('1️⃣ Navigating to login...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, '01_login.png'), fullPage: true });

  // Login using React-compatible events
  console.log('2️⃣ Logging in...');
  await page.evaluate(() => {
    const emailEl = document.querySelector('input[type="email"]');
    const pwEl = document.querySelector('input[type="password"]');
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(emailEl, 'demo@middleground.app');
    emailEl.dispatchEvent(new Event('input', { bubbles: true }));
    nativeInputValueSetter.call(pwEl, 'test123');
    pwEl.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await delay(300);
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.includes('Sign In')) { b.click(); break; } }
  });
  await delay(3000);

  // Take Plan tab screenshot
  console.log('3️⃣ Plan tab...');
  await page.screenshot({ path: path.join(OUT, '02_plan_tab.png'), fullPage: true });
  const userLoc = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) { if (inp.value.includes('San Jose')) return inp.value; }
    return 'NOT FOUND';
  });
  console.log('   ✅ User location:', userLoc);

  // Click FRIENDS tab using button text content
  console.log('4️⃣ Friends tab...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button.nav-btn');
    for (const b of btns) { if (b.textContent.includes('Friends')) { b.click(); break; } }
  });
  await delay(1500);
  await page.screenshot({ path: path.join(OUT, '03_friends_tab.png'), fullPage: true });
  const friendInfo = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasSophia: body.includes('Sophia'),
      hasPriya: body.includes('Priya'),
      hasLeo: body.includes('Leo'),
      hasMarco: body.includes('Marco'),
      text: body.substring(0, 500)
    };
  });
  console.log('   Sophia:', friendInfo.hasSophia, '| Priya:', friendInfo.hasPriya, '| Leo:', friendInfo.hasLeo, '| Marco:', friendInfo.hasMarco);

  // Click INVITES tab
  console.log('5️⃣ Invites tab...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button.nav-btn');
    for (const b of btns) { if (b.textContent.includes('Invites')) { b.click(); break; } }
  });
  await delay(2000);
  await page.screenshot({ path: path.join(OUT, '04_invites_received.png'), fullPage: true });
  const invInfo = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasSophia: body.includes('Sophia'),
      hasMarco: body.includes('Marco'),
      hasPriya: body.includes('Priya'),
      hasNina: body.includes('Nina'),
      hasTyler: body.includes('Tyler'),
      hasWeekend: body.includes('Weekend'),
      hasOakland: body.includes('Oakland'),
      hasGroup: body.includes('Group') || body.includes('GROUP'),
    };
  });
  console.log('   Sophia invite:', invInfo.hasSophia, '| Marco:', invInfo.hasMarco, '| Priya:', invInfo.hasPriya, '| Nina:', invInfo.hasNina, '| Tyler:', invInfo.hasTyler);

  // Scroll down to see all invites
  await page.evaluate(() => window.scrollBy(0, 500));
  await delay(500);
  await page.screenshot({ path: path.join(OUT, '04b_invites_scrolled.png'), fullPage: true });

  // Click "View Plan" on first invite to expand details  
  console.log('6️⃣ Expanding invite stops...');
  const expanded = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      const t = b.textContent.trim();
      if (t.includes('View Plan') || t.includes('View Stops') || t.includes('stops')) { b.click(); return t; }
    }
    return false;
  });
  console.log('   Clicked:', expanded);
  await delay(1500);
  await page.screenshot({ path: path.join(OUT, '05_invite_view.png'), fullPage: true });

  // Scroll down for stop details 
  await page.evaluate(() => window.scrollBy(0, 400));
  await delay(500);
  await page.screenshot({ path: path.join(OUT, '05b_invite_stops.png'), fullPage: true });

  // Check for ETA and transport info in the page
  const etaCheck = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasCalculating: body.includes('Calculating'),
      has15mins: body.includes('15 mins'),
      has31mins: body.includes('31 mins'),
      hasDash: body.includes('—'),
      hasWalk: body.includes('walk'),
      hasDrive: body.includes('drive'),
      hasExplore: body.includes('Explore in area'),
      hasSeeDirections: body.includes('See Directions'),
    };
  });
  console.log('   "Calculating" text:', etaCheck.hasCalculating);
  console.log('   "15 mins" ETA:', etaCheck.has15mins);
  console.log('   "31 mins" ETA:', etaCheck.has31mins);
  console.log('   Shows "walk":', etaCheck.hasWalk);
  console.log('   Shows "drive":', etaCheck.hasDrive);
  console.log('   "Explore in area":', etaCheck.hasExplore);
  console.log('   "See Directions":', etaCheck.hasSeeDirections);

  // Scroll more for more stop details
  await page.evaluate(() => window.scrollBy(0, 500));
  await delay(500);
  await page.screenshot({ path: path.join(OUT, '05c_invite_walking.png'), fullPage: true });

  // 7: Click See Directions
  console.log('7️⃣ See Directions...');
  const dirClicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent.includes('See Directions')) { b.click(); return true; }
    }
    return false;
  });
  console.log('   Clicked:', dirClicked);
  await delay(3000);
  await page.screenshot({ path: path.join(OUT, '06_directions_modal.png'), fullPage: true });

  // Check directions modal text
  const dirCheck = await page.evaluate(() => {
    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) return { found: false };
    const text = overlay.innerText;
    return {
      found: true,
      hasTripDirections: text.includes('Trip Directions'),
      hasCalculatingRoute: text.includes('Calculating route'),
      hasLoadingDirections: text.includes('Loading directions'),
      hasOpenMaps: text.includes('Open in Google Maps'),
      textPreview: text.substring(0, 400),
    };
  });
  console.log('   Modal found:', dirCheck.found);
  if (dirCheck.found) {
    console.log('   "Trip Directions":', dirCheck.hasTripDirections);
    console.log('   "Calculating route" (should be FALSE):', dirCheck.hasCalculatingRoute);
    console.log('   "Loading directions":', dirCheck.hasLoadingDirections);
    console.log('   "Open in Google Maps":', dirCheck.hasOpenMaps);
  }

  // Close modal
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.trim() === '×') { b.click(); break; } }
  });
  await delay(500);

  // 8: Go to plan tab, select a friend, check auto-fill
  console.log('8️⃣ Plan tab + selecting friend...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button.nav-btn');
    for (const b of btns) { if (b.textContent.includes('Plan')) { b.click(); break; } }
  });
  await delay(1000);

  // Click Sophia avatar
  await page.evaluate(() => {
    const avatars = document.querySelectorAll('.friend-avatar');
    if (avatars[0]) avatars[0].click();
  });
  await delay(800);
  await page.screenshot({ path: path.join(OUT, '07_friend_selected.png'), fullPage: true });

  // Check friend location auto-fill
  const locs = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    const vals = [];
    for (const inp of inputs) {
      if (inp.value && !inp.value.includes('Search') && !inp.value.includes('search')) vals.push(inp.value);
    }
    return vals;
  });
  console.log('   ✅ Locations after friend selected:', locs);

  console.log('\n🎉 ALL TESTS COMPLETE! Screenshots in test_screenshots/');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Bug #2  ETA: No "Calculating" text =', !etaCheck?.hasCalculating ? '✅ PASS' : '❌ FAIL');
  console.log('Bug #6  Transport: Shows walk/drive =', (etaCheck?.hasWalk || etaCheck?.hasDrive) ? '✅ PASS' : '❌ FAIL');
  console.log('Bug #9  Profile location auto-fill =', userLoc === 'San Jose, CA, USA' ? '✅ PASS' : '❌ FAIL');
  console.log('Bug #9  Friend location auto-fill =', locs?.some(l => l.includes('Fremont')) ? '✅ PASS' : '❌ FAIL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await browser.close();
}

run().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
