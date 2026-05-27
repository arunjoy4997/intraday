/* ============================================================================
   INTRADAY EDGE — Combined Worker  (Cloudflare Workers)
   ----------------------------------------------------------------------------
   This single Worker does TWO things:
   1. Serves the full dashboard HTML at GET /
   2. Handles all data API calls at GET /?symbol=...&mode=...

   Deploy this ONE file to Cloudflare Workers.
   Then open https://intraday-data.arunlovesmessi10.workers.dev/ on your phone.
   That's it — fully live, no separate hosting needed.
   ============================================================================ */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// The full dashboard HTML — served at GET /
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Intraday Edge — Indian Stock Trading Suggestions</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Spline+Sans+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#0a0e14; --panel:#11161f; --panel-2:#161c28; --line:#222a39;
    --ink:#e8ecf3; --muted:#8a93a6; --faint:#5a6275;
    --green:#1fc96b; --green-dim:#0f6e3c; --red:#ff4d5e; --red-dim:#7a2530;
    --amber:#ffb020; --blue:#3d8bff; --accent:#c8ff3d;
    --mono:'Spline Sans Mono',monospace; --sans:'Archivo',sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:var(--bg);color:var(--ink);font-family:var(--sans);
    -webkit-font-smoothing:antialiased}
  body{background-image:radial-gradient(900px 500px at 85% -10%,rgba(61,139,255,.08),transparent),
    radial-gradient(700px 400px at 10% 110%,rgba(200,255,61,.05),transparent)}
  a{color:inherit}
  ::selection{background:var(--accent);color:#000}

  .wrap{max-width:1180px;margin:0 auto;padding:0 14px}

  /* Mobile touch targets and sizing */
  @media(max-width:480px){
    .wrap{padding:0 10px}
    .brand h1{font-size:18px}
    .controls{gap:7px}
    button.btn{padding:8px 11px;font-size:11px}
    .strip{grid-template-columns:repeat(2,1fr);gap:8px}
    .stat .v{font-size:20px}
    .card{padding:12px 13px}
    .c-sym{font-size:15px}
    .c-ltp .price{font-size:14px}
    .modal{border-radius:12px 12px 0 0}
    .overlay{padding:0;align-items:flex-end}
    .m-body{padding:14px 15px}
    .m-hd{padding:14px 15px}
    .plan{grid-template-columns:repeat(2,1fr)}
    .bt-grid{grid-template-columns:repeat(2,1fr)}
  }

  /* Header */
  header{border-bottom:1px solid var(--line);padding:20px 0 18px;
    position:sticky;top:0;background:rgba(10,14,20,.92);backdrop-filter:blur(10px);z-index:50}
  .hd{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
  .brand{display:flex;align-items:baseline;gap:11px}
  .brand h1{font-size:23px;font-weight:900;letter-spacing:-.5px}
  .brand .dot{width:9px;height:9px;border-radius:50%;background:var(--accent);
    box-shadow:0 0 14px var(--accent);align-self:center}
  .brand small{font-family:var(--mono);color:var(--faint);font-size:11px;letter-spacing:1px}
  .clock{font-family:var(--mono);font-size:12px;color:var(--muted);text-align:right}
  .clock .session{font-weight:600}
  .clock .session.open{color:var(--green)}
  .clock .session.closed{color:var(--red)}

  .controls{display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap}
  button.btn{font-family:var(--mono);font-size:12px;font-weight:600;cursor:pointer;
    background:var(--panel-2);border:1px solid var(--line);color:var(--ink);
    padding:9px 15px;border-radius:8px;transition:.15s;letter-spacing:.3px}
  button.btn:hover{border-color:var(--faint);background:var(--panel)}
  button.btn.primary{background:var(--accent);color:#000;border-color:var(--accent)}
  button.btn.primary:hover{filter:brightness(1.08)}
  .scan-note{font-family:var(--mono);font-size:11px;color:var(--faint)}

  /* Summary strip */
  .strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0}
  .stat{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:14px 16px}
  .stat .k{font-family:var(--mono);font-size:10px;letter-spacing:1.2px;color:var(--faint);
    text-transform:uppercase}
  .stat .v{font-size:26px;font-weight:800;margin-top:5px;letter-spacing:-.5px}
  .stat .v small{font-size:13px;color:var(--muted);font-weight:600}

  /* Category sections */
  .cat{margin:26px 0}
  .cat-hd{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .cat-hd h2{font-size:15px;font-weight:800;letter-spacing:.2px}
  .cat-hd .tag{font-family:var(--mono);font-size:10px;color:var(--bg);background:var(--muted);
    padding:3px 8px;border-radius:5px;font-weight:600}
  .cat-hd .rule{flex:1;height:1px;background:var(--line)}
  .cat-hd .count{font-family:var(--mono);font-size:11px;color:var(--faint)}

  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:13px}
  @media(max-width:780px){.grid{grid-template-columns:1fr}
    .strip{grid-template-columns:repeat(2,1fr)}}

  /* Pick card */
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;
    padding:15px 16px;cursor:pointer;transition:.16s;position:relative;overflow:hidden}
  .card:hover{border-color:var(--faint);transform:translateY(-2px)}
  .card .side-bar{position:absolute;left:0;top:0;bottom:0;width:3px}
  .card.long .side-bar{background:var(--green)}
  .card.short .side-bar{background:var(--red)}
  .c-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
  .c-sym{font-size:17px;font-weight:800;letter-spacing:-.3px}
  .c-name{font-size:11px;color:var(--muted);margin-top:1px}
  .cap-badge{font-family:var(--mono);font-size:9px;font-weight:700;padding:2px 6px;
    border-radius:4px;letter-spacing:.6px;vertical-align:2px;margin-left:6px}
  .cap-badge.large{background:#1a2a4a;color:#6aa3ff}
  .cap-badge.mid{background:#2a1f40;color:#b87aff}
  .cap-badge.small{background:#2a2010;color:#ffb020}
  .vol-badge{font-family:var(--mono);font-size:9px;font-weight:700;padding:2px 6px;
    border-radius:4px;letter-spacing:.5px;margin-left:4px}
  .vol-badge.low{background:#1a2a1a;color:#4caf50}
  .vol-badge.med{background:#2a2510;color:#ffb020}
  .vol-badge.high{background:#2a1515;color:#ff6b6b}
  .c-ltp{text-align:right;font-family:var(--mono)}
  .c-ltp .price{font-size:16px;font-weight:600}
  .c-ltp .chg{font-size:11px;font-weight:500}
  .up{color:var(--green)} .down{color:var(--red)}

  .c-mid{display:flex;align-items:center;gap:10px;margin:13px 0 11px}
  .signal{font-family:var(--mono);font-size:11px;font-weight:700;padding:4px 9px;
    border-radius:6px;letter-spacing:.5px}
  .signal.long{background:var(--green-dim);color:var(--green)}
  .signal.short{background:var(--red-dim);color:var(--red)}

  .conf{flex:1}
  .conf-row{display:flex;justify-content:space-between;font-family:var(--mono);
    font-size:10px;color:var(--faint);margin-bottom:4px}
  .conf-row b{color:var(--ink);font-size:11px}
  .bar{height:6px;background:var(--panel-2);border-radius:4px;overflow:hidden}
  .bar > div{height:100%;border-radius:4px;transition:width .5s}

  .c-levels{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
    border-top:1px solid var(--line);padding-top:11px}
  .lv{font-family:var(--mono)}
  .lv .lk{font-size:9px;letter-spacing:.8px;color:var(--faint);text-transform:uppercase}
  .lv .lv-v{font-size:13px;font-weight:600;margin-top:2px}
  .lv.entry .lv-v{color:var(--blue)}
  .lv.target .lv-v{color:var(--green)}
  .lv.stop .lv-v{color:var(--red)}

  /* Detail modal */
  .overlay{position:fixed;inset:0;background:rgba(5,7,11,.78);backdrop-filter:blur(4px);
    z-index:100;display:none;align-items:flex-start;justify-content:center;
    overflow-y:auto;padding:34px 18px}
  .overlay.show{display:flex}
  .modal{background:var(--panel);border:1px solid var(--line);border-radius:15px;
    max-width:760px;width:100%;animation:rise .22s ease}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .m-hd{padding:20px 22px;border-bottom:1px solid var(--line);
    display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
  .m-hd .x{cursor:pointer;font-family:var(--mono);font-size:13px;color:var(--muted);
    background:var(--panel-2);border:1px solid var(--line);border-radius:7px;
    padding:6px 11px;transition:.15s}
  .m-hd .x:hover{color:var(--ink);border-color:var(--faint)}
  .m-body{padding:20px 22px}
  .m-sym{font-size:25px;font-weight:900;letter-spacing:-.6px}
  .m-name{font-size:12px;color:var(--muted);margin-top:2px}

  .verdict{display:flex;gap:14px;align-items:center;background:var(--panel-2);
    border:1px solid var(--line);border-radius:11px;padding:15px 17px;margin-bottom:18px}
  .verdict .big-conf{font-size:40px;font-weight:900;line-height:1;letter-spacing:-1.5px}
  .verdict .vmeta{flex:1}
  .verdict .vmeta .vl{font-family:var(--mono);font-size:10px;letter-spacing:1px;
    color:var(--faint);text-transform:uppercase}
  .verdict .vmeta .vd{font-size:13px;color:var(--muted);margin-top:3px;line-height:1.5}

  .sec-t{font-family:var(--mono);font-size:11px;letter-spacing:1.4px;color:var(--accent);
    text-transform:uppercase;margin:20px 0 11px;font-weight:600}

  .plan{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  @media(max-width:620px){.plan{grid-template-columns:repeat(2,1fr)}}
  .pcell{background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:12px}
  .pcell .pk{font-family:var(--mono);font-size:9px;letter-spacing:.8px;color:var(--faint);
    text-transform:uppercase}
  .pcell .pv{font-family:var(--mono);font-size:17px;font-weight:600;margin-top:5px}
  .pcell .ps{font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:3px}

  .ind-table{width:100%;border-collapse:collapse;font-size:12px}
  .ind-table th{font-family:var(--mono);font-size:9px;letter-spacing:.8px;color:var(--faint);
    text-transform:uppercase;text-align:left;padding:7px 9px;border-bottom:1px solid var(--line)}
  .ind-table td{padding:9px;border-bottom:1px solid var(--line);font-family:var(--mono)}
  .ind-table tr:last-child td{border-bottom:none}
  .ind-name{font-weight:600;font-family:var(--sans)!important}
  .ind-val{color:var(--muted)}
  .pill{font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;letter-spacing:.4px}
  .pill.bull{background:var(--green-dim);color:var(--green)}
  .pill.bear{background:var(--red-dim);color:var(--red)}
  .pill.neut{background:var(--panel);color:var(--muted);border:1px solid var(--line)}
  .ind-wt{color:var(--faint);font-size:10px}

  .reason-list{list-style:none;display:flex;flex-direction:column;gap:8px}
  .reason-list li{display:flex;gap:10px;font-size:13px;line-height:1.5;color:var(--ink);
    background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:10px 12px}
  .reason-list li .mk{font-family:var(--mono);font-weight:700;flex-shrink:0}
  .reason-list li.pos .mk{color:var(--green)}
  .reason-list li.neg .mk{color:var(--red)}
  .reason-list li.info .mk{color:var(--blue)}

  .news-item{background:var(--panel-2);border:1px solid var(--line);border-radius:8px;
    padding:11px 13px;margin-bottom:8px}
  .news-item .nh{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
  .news-item .nt{font-size:12.5px;line-height:1.45;font-weight:500}
  .news-item .nmeta{font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:5px}
  .sent{font-family:var(--mono);font-size:9px;font-weight:700;padding:2px 7px;
    border-radius:4px;flex-shrink:0;letter-spacing:.4px}
  .sent.pos{background:var(--green-dim);color:var(--green)}
  .sent.neg{background:var(--red-dim);color:var(--red)}
  .sent.neu{background:var(--panel);color:var(--muted);border:1px solid var(--line)}

  .disclaimer{margin:30px 0 40px;padding:15px 17px;background:var(--panel);
    border:1px solid var(--red-dim);border-radius:10px;font-size:11.5px;
    color:var(--muted);line-height:1.6}
  .disclaimer b{color:var(--red)}

  .empty{text-align:center;padding:40px;color:var(--faint);font-family:var(--mono);font-size:12px}
  /* Backtest UI */
  .bt-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
  @media(max-width:620px){.bt-grid{grid-template-columns:repeat(2,1fr)}}
  .bt-stat{background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:12px 14px}
  .bt-stat .bk{font-family:var(--mono);font-size:9px;letter-spacing:.8px;text-transform:uppercase;color:var(--faint)}
  .bt-stat .bv{font-size:22px;font-weight:800;margin-top:4px;letter-spacing:-.5px}
  .bt-table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:18px}
  .bt-table th{font-family:var(--mono);font-size:9px;letter-spacing:.8px;color:var(--faint);
    text-transform:uppercase;text-align:left;padding:7px 8px;border-bottom:1px solid var(--line)}
  .bt-table td{padding:7px 8px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:11px}
  .bt-table tr:last-child td{border-bottom:none}
  .bt-table tr:hover td{background:var(--panel-2)}
  .bt-win{color:var(--green);font-weight:700}
  .bt-loss{color:var(--red);font-weight:700}
  .bt-t1{color:var(--amber);font-weight:600}
  .bt-open{color:var(--faint)}
  .wt-bar{height:8px;background:var(--panel-2);border-radius:4px;overflow:hidden;margin-top:5px}
  .wt-bar>div{height:100%;border-radius:4px;background:var(--accent)}
  .progress-wrap{margin:16px 0;background:var(--panel-2);border:1px solid var(--line);
    border-radius:8px;overflow:hidden;height:10px}
  .progress-bar{height:100%;background:var(--blue);transition:width .3s}
  footer{border-top:1px solid var(--line);padding:18px 0 34px;
    font-family:var(--mono);font-size:10px;color:var(--faint);text-align:center}
</style>
</head>
<body>

<header>
  <div class="wrap">
    <div class="hd">
      <div class="brand">
        <span class="dot"></span>
        <h1>INTRADAY EDGE</h1>
        <small>NSE / BSE · INDIA</small>
      </div>
      <div class="clock">
        <div id="clockTime">--:--:--</div>
        <div class="session" id="sessionState">MARKET ·</div>
      </div>
    </div>
    <div class="controls">
      <button class="btn primary" id="scanBtn">⟳ RUN SCAN</button>
      <button class="btn" id="backtestBtn">📊 BACKTEST</button>
      <button class="btn" id="aiNewsBtn">⚡ AI NEWS</button>
      <button class="btn" id="sortConf">SORT: CONFIDENCE</button>
      <button class="btn" id="filterSide">SHOW: ALL</button>
      <button class="btn" id="filterCap">CAP: ALL</button>
      <button class="btn" id="filterConf">CONF: ALL</button>
      <span class="scan-note" id="scanNote">Last scan: never</span>
    </div>
  </div>
</header>

<div class="wrap">
  <div class="strip" id="strip"></div>
  <div id="categories"></div>
  <div class="disclaimer">
    <b>⚠ EDUCATIONAL TOOL — NOT INVESTMENT ADVICE.</b> Intraday trading carries a high risk
    of capital loss. This system generates suggestions from technical models and sample data;
    it does not guarantee outcomes. Confidence scores reflect indicator agreement, not
    probability of profit. Always verify with live data, use stop-losses, and consult a
    SEBI-registered advisor before trading. Past behaviour does not predict future results.
  </div>
</div>

<div class="overlay" id="overlay">
  <div class="modal" id="modal"></div>
</div>

<div class="overlay" id="btOverlay">
  <div class="modal" style="max-width:900px;width:100%" id="btModal"></div>
</div>

<footer>
  <div class="wrap">INTRADAY EDGE · zero-token scoring engine · plug your data API into <code>DataAdapter.fetch()</code></div>
</footer>

<script>
/* ============================================================================
   INTRADAY EDGE — Indian Stock Intraday Suggestion Engine
   ----------------------------------------------------------------------------
   ARCHITECTURE (token-efficient by design):
   - All indicator math + scoring runs in pure JS in the browser. ZERO AI calls.
   - DataAdapter is the ONLY place that touches external data. Swap the demo
     generator for a real API (Yahoo/NSE/Zerodha Kite) and nothing else changes.
   - News sentiment uses a keyword classifier (no LLM). Optionally swap for an
     AI call inside NewsEngine.classify() if you ever want it.
   ========================================================================== */

/* ---------- 1. DATA ADAPTER -------------------------------------------------
   To go live: replace DataAdapter.fetch() with a real fetch() to your API.
   It must return, per symbol: { candles:[{o,h,l,c,v}...], news:[...] }
   \`candles\` = intraday OHLCV (e.g. 5-min bars), oldest first, ~80+ bars.
--------------------------------------------------------------------------- */
const UNIVERSE = [
  // [symbol, name, approxPrice, sector, capSize]
  // capSize: 'large' | 'mid' | 'small'
  // Prices are approximate references for demo mode only — live mode uses real LTP from Worker

  // ── LARGE CAP — Nifty 50 / Nifty Next 50 ──────────────────────────────────
  ['RELIANCE','Reliance Industries',1355,'Energy','large'],
  ['TCS','Tata Consultancy Services',3520,'IT','large'],
  ['HDFCBANK','HDFC Bank',1680,'Banking','large'],
  ['BHARTIARTL','Bharti Airtel',1625,'Telecom','large'],
  ['ICICIBANK','ICICI Bank',1420,'Banking','large'],
  ['SBIN','State Bank of India',820,'Banking','large'],
  ['INFY','Infosys',1548,'IT','large'],
  ['HINDUNILVR','Hindustan Unilever',2370,'FMCG','large'],
  ['ITC','ITC Ltd',448,'FMCG','large'],
  ['BAJFINANCE','Bajaj Finance',6950,'NBFC','large'],
  ['HCLTECH','HCL Technologies',1620,'IT','large'],
  ['MARUTI','Maruti Suzuki',12500,'Auto','large'],
  ['SUNPHARMA','Sun Pharma',1760,'Pharma','large'],
  ['AXISBANK','Axis Bank',1155,'Banking','large'],
  ['TITAN','Titan Company',3380,'Consumer','large'],
  ['KOTAKBANK','Kotak Mahindra Bank',2120,'Banking','large'],
  ['WIPRO','Wipro Ltd',302,'IT','large'],
  ['ULTRACEMCO','UltraTech Cement',11150,'Cement','large'],
  ['NESTLEIND','Nestle India',2285,'FMCG','large'],
  ['ONGC','Oil & Natural Gas',248,'Energy','large'],
  ['NTPC','NTPC Ltd',365,'Utilities','large'],
  ['POWERGRID','Power Grid Corp',320,'Utilities','large'],
  ['TATASTEEL','Tata Steel',165,'Metals','large'],
  ['TATAMOTORS','Tata Motors',795,'Auto','large'],
  ['JSWSTEEL','JSW Steel',950,'Metals','large'],
  ['ADANIPORTS','Adani Ports',1390,'Infra','large'],
  ['ADANIENT','Adani Enterprises',2480,'Conglomerate','large'],
  ['COALINDIA','Coal India',395,'Energy','large'],
  ['BAJAJFINSV','Bajaj Finserv',1985,'NBFC','large'],
  ['LT','Larsen & Toubro',3640,'Infra','large'],
  ['TECHM','Tech Mahindra',1458,'IT','large'],
  ['CIPLA','Cipla Ltd',1560,'Pharma','large'],
  ['ASIANPAINT','Asian Paints',2290,'Consumer','large'],
  ['GRASIM','Grasim Industries',2720,'Cement','large'],
  ['EICHERMOT','Eicher Motors',5450,'Auto','large'],
  ['DIVISLAB','Divi\\'s Laboratories',5720,'Pharma','large'],
  ['DRREDDY','Dr Reddy\\'s Labs',6380,'Pharma','large'],
  ['BRITANNIA','Britannia Industries',5180,'FMCG','large'],
  ['BPCL','BPCL',298,'Energy','large'],
  ['TATACONSUM','Tata Consumer',1085,'FMCG','large'],
  ['HINDALCO','Hindalco Industries',680,'Metals','large'],
  ['APOLLOHOSP','Apollo Hospitals',6850,'Healthcare','large'],
  ['HEROMOTOCO','Hero MotoCorp',4280,'Auto','large'],
  ['BAJAJ-AUTO','Bajaj Auto',9520,'Auto','large'],
  ['VEDL','Vedanta Ltd',468,'Metals','large'],
  ['INDUSINDBK','IndusInd Bank',1020,'Banking','large'],
  ['ZOMATO','Eternal (Zomato)',262,'Internet','large'],
  ['SHREECEM','Shree Cement',28500,'Cement','large'],
  ['M&M','Mahindra & Mahindra',3120,'Auto','large'],
  ['TRENT','Trent Ltd',5900,'Retail','large'],

  // ── MID CAP — Nifty Midcap 100 ────────────────────────────────────────────
  ['AUROPHARMA','Aurobindo Pharma',1285,'Pharma','mid'],
  ['BANKBARODA','Bank of Baroda',242,'Banking','mid'],
  ['CANBK','Canara Bank',102,'Banking','mid'],
  ['IDFCFIRSTB','IDFC First Bank',68,'Banking','mid'],
  ['PNB','Punjab National Bank',105,'Banking','mid'],
  ['UNIONBANK','Union Bank of India',118,'Banking','mid'],
  ['FEDERALBNK','Federal Bank',195,'Banking','mid'],
  ['KARURVYSYA','Karur Vysya Bank',228,'Banking','mid'],
  ['LICHSGFIN','LIC Housing Finance',618,'NBFC','mid'],
  ['MUTHOOTFIN','Muthoot Finance',2180,'NBFC','mid'],
  ['CHOLAFIN','Cholamandalam Finance',1480,'NBFC','mid'],
  ['RECLTD','REC Ltd',512,'NBFC','mid'],
  ['PFC','Power Finance Corp',468,'NBFC','mid'],
  ['IRFC','Indian Railway Finance',198,'NBFC','mid'],
  ['ABCAPITAL','Aditya Birla Capital',198,'NBFC','mid'],
  ['SAIL','Steel Authority of India',138,'Metals','mid'],
  ['NMDC','NMDC Ltd',218,'Metals','mid'],
  ['NATIONALUM','National Aluminium',228,'Metals','mid'],
  ['HINDCOPPER','Hindustan Copper',328,'Metals','mid'],
  ['WELCORP','Welspun Corp',695,'Metals','mid'],
  ['APOLLOTYRE','Apollo Tyres',548,'Auto','mid'],
  ['MOTHERSON','Samvardhana Motherson',178,'Auto','mid'],
  ['BALKRISIND','Balkrishna Industries',2880,'Auto','mid'],
  ['EXIDEIND','Exide Industries',398,'Auto','mid'],
  ['AMARAJABAT','Amara Raja Energy',1198,'Auto','mid'],
  ['TVSMOTOR','TVS Motor Company',2650,'Auto','mid'],
  ['ASHOKLEY','Ashok Leyland',245,'Auto','mid'],
  ['MRF','MRF Ltd',128500,'Auto','mid'],
  ['ZYDUSLIFE','Zydus Lifesciences',1198,'Pharma','mid'],
  ['TORNTPHARM','Torrent Pharma',3480,'Pharma','mid'],
  ['ALKEM','Alkem Laboratories',5280,'Pharma','mid'],
  ['GLENMARK','Glenmark Pharma',1568,'Pharma','mid'],
  ['IPCALAB','IPCA Laboratories',1680,'Pharma','mid'],
  ['AJANTPHARM','Ajanta Pharma',2985,'Pharma','mid'],
  ['GRANULES','Granules India',548,'Pharma','mid'],
  ['CONCOR','Container Corp of India',872,'Logistics','mid'],
  ['INDIAMART','IndiaMART InterMESH',2485,'Internet','mid'],
  ['NAUKRI','Info Edge (Naukri)',8750,'Internet','mid'],
  ['PERSISTENT','Persistent Systems',5680,'IT','mid'],
  ['MPHASIS','Mphasis Ltd',2980,'IT','mid'],
  ['LTTS','L&T Technology Services',4980,'IT','mid'],
  ['COFORGE','Coforge Ltd',8950,'IT','mid'],
  ['KPITTECH','KPIT Technologies',1620,'IT','mid'],
  ['TATAELXSI','Tata Elxsi',6480,'IT','mid'],
  ['OFSS','Oracle Financial Services',12800,'IT','mid'],
  ['PIIND','PI Industries',4280,'Agro','mid'],
  ['UBL','United Breweries',1985,'FMCG','mid'],
  ['MCDOWELL-N','United Spirits',1148,'FMCG','mid'],
  ['COLPAL','Colgate-Palmolive',2980,'FMCG','mid'],
  ['MARICO','Marico Ltd',648,'FMCG','mid'],
  ['EMAMILTD','Emami Ltd',568,'FMCG','mid'],
  ['DABUR','Dabur India',548,'FMCG','mid'],
  ['GODREJCP','Godrej Consumer Prod',1295,'FMCG','mid'],
  ['VOLTAS','Voltas Ltd',1680,'Consumer','mid'],
  ['HAVELLS','Havells India',1758,'Consumer','mid'],
  ['CROMPTON','Crompton Greaves Cons',368,'Consumer','mid'],
  ['WHIRLPOOL','Whirlpool India',1548,'Consumer','mid'],
  ['BATAINDIA','Bata India',1548,'Consumer','mid'],
  ['PAGEIND','Page Industries',42800,'Consumer','mid'],
  ['RELAXO','Relaxo Footwear',878,'Consumer','mid'],
  ['ABFRL','Aditya Birla Fashion',298,'Retail','mid'],
  ['DMART','Avenue Supermarts',4280,'Retail','mid'],
  ['TATACOMM','Tata Communications',1948,'Telecom','mid'],
  ['INDUSTOWER','Indus Towers',348,'Telecom','mid'],
  ['MTNL','MTNL',48,'Telecom','mid'],
  ['CESC','CESC Ltd',168,'Utilities','mid'],
  ['TORNTPOWER','Torrent Power',1648,'Utilities','mid'],
  ['TATAPOWER','Tata Power',428,'Utilities','mid'],
  ['ADANIPOWER','Adani Power',548,'Utilities','mid'],
  ['ADANIGREEN','Adani Green Energy',1198,'Utilities','mid'],
  ['JSWENERGY','JSW Energy',548,'Utilities','mid'],
  ['NHPC','NHPC Ltd',98,'Utilities','mid'],
  ['SJVN','SJVN Ltd',118,'Utilities','mid'],
  ['IRCON','Ircon International',198,'Infra','mid'],
  ['IRB','IRB Infrastructure',68,'Infra','mid'],
  ['GMRAIRPORT','GMR Airports',98,'Infra','mid'],
  ['AIAENG','AIA Engineering',3980,'Engineering','mid'],
  ['BHEL','Bharat Heavy Electricals',268,'Engineering','mid'],
  ['BEL','Bharat Electronics',298,'Defence','mid'],
  ['HAL','Hindustan Aeronautics',4280,'Defence','mid'],
  ['COCHINSHIP','Cochin Shipyard',1998,'Defence','mid'],
  ['GRINDWELL','Grindwell Norton',2298,'Engineering','mid'],
  ['THERMAX','Thermax Ltd',3980,'Engineering','mid'],
  ['ABB','ABB India',5680,'Engineering','mid'],
  ['SIEMENS','Siemens India',6480,'Engineering','mid'],
  ['CUMMINSIND','Cummins India',3580,'Engineering','mid'],
  ['SCHAEFFLER','Schaeffler India',4480,'Auto','mid'],
  ['SUNDRMFAST','Sundram Fasteners',1298,'Auto','mid'],
  ['TIINDIA','Tube Investments',3580,'Auto','mid'],
  ['OBEROIRLTY','Oberoi Realty',1948,'Realty','mid'],
  ['PRESTIGE','Prestige Estates',1648,'Realty','mid'],
  ['GODREJPROP','Godrej Properties',2148,'Realty','mid'],
  ['DLF','DLF Ltd',898,'Realty','mid'],
  ['PHOENIXLTD','Phoenix Mills',1548,'Realty','mid'],
  ['LTIM','LTIMindtree',5480,'IT','mid'],
  ['TANLA','Tanla Platforms',998,'IT','mid'],

  // ── SMALL CAP — Nifty Smallcap 100 + high-volume cash segment ─────────────
  ['IDEA','Vodafone Idea',9,'Telecom','small'],
  ['YESBANK','Yes Bank',22,'Banking','small'],
  ['SUZLON','Suzlon Energy',68,'Utilities','small'],
  ['IREDA','IREDA',198,'NBFC','small'],
  ['RVNL','Rail Vikas Nigam',478,'Infra','small'],
  ['RAILTEL','RailTel Corp',388,'IT','small'],
  ['NBCC','NBCC (India)',98,'Infra','small'],
  ['HFCL','HFCL Ltd',128,'Telecom','small'],
  ['RPOWER','Reliance Power',48,'Utilities','small'],
  ['JPPOWER','Jaiprakash Power',18,'Utilities','small'],
  ['ADANIENSOL','Adani Energy Solutions',898,'Utilities','small'],
  ['PCJEWELLER','PC Jeweller',78,'Consumer','small'],
  ['SENCO','Senco Gold',1198,'Consumer','small'],
  ['KALYANKJIL','Kalyan Jewellers',598,'Consumer','small'],
  ['RAYMOND','Raymond Ltd',1898,'Consumer','small'],
  ['MOIL','MOIL Ltd',448,'Metals','small'],
  ['GPIL','Godawari Power & Ispat',1198,'Metals','small'],
  ['JINDALSAW','Jindal Saw',298,'Metals','small'],
  ['RATNAMANI','Ratnamani Metals',3248,'Metals','small'],
  ['FINEORG','Fine Organic Ind',4980,'Chemicals','small'],
  ['AARTIIND','Aarti Industries',548,'Chemicals','small'],
  ['NAVINFLUOR','Navin Fluorine',3580,'Chemicals','small'],
  ['CLEAN','Clean Science Tech',1348,'Chemicals','small'],
  ['ALKYLAMINE','Alkyl Amines',2248,'Chemicals','small'],
  ['VINATIORGA','Vinati Organics',1898,'Chemicals','small'],
  ['DEEPAKNTR','Deepak Nitrite',2648,'Chemicals','small'],
  ['GALAXYSURF','Galaxy Surfactants',3248,'Chemicals','small'],
  ['IONEXCHANG','Ion Exchange',748,'Chemicals','small'],
  ['TATACHEM','Tata Chemicals',1048,'Chemicals','small'],
  ['JUBLFOOD','Jubilant Foodworks',698,'Consumer','small'],
  ['DEVYANI','Devyani International',148,'Consumer','small'],
  ['WESTLIFE','Westlife Foodworld',798,'Consumer','small'],
  ['SAPPHIRE','Sapphire Foods',1398,'Consumer','small'],
  ['CAMPUS','Campus Activewear',248,'Consumer','small'],
  ['VSTIND','VST Industries',3548,'FMCG','small'],
  ['RADICO','Radico Khaitan',2298,'FMCG','small'],
  ['GLOBUSSPR','Globus Spirits',898,'FMCG','small'],
  ['ZYDUSWELL','Zydus Wellness',1948,'FMCG','small'],
  ['HONAUT','Honeywell Automation',42800,'Engineering','small'],
  ['ELGIEQUIP','Elgi Equipments',698,'Engineering','small'],
  ['GREAVESCOT','Greaves Cotton',198,'Engineering','small'],
  ['ESAB','ESAB India',4248,'Engineering','small'],
  ['ELECON','Elecon Engineering',698,'Engineering','small'],
  ['PRAJIND','Praj Industries',698,'Engineering','small'],
  ['GPPL','Gujarat Pipavav Port',248,'Logistics','small'],
  ['BLUEDART','Blue Dart Express',7980,'Logistics','small'],
  ['MAHLOG','Mahindra Logistics',398,'Logistics','small'],
  ['GESHIP','Great Eastern Shipping',1098,'Logistics','small'],
  ['SPARC','Sun Pharma Advanced',348,'Pharma','small'],
  ['LAURUSLABS','Laurus Labs',448,'Pharma','small'],
  ['SOLARA','Solara Active Pharma',1048,'Pharma','small'],
  ['GLAND','Gland Pharma',1598,'Pharma','small'],
  ['ERIS','Eris Lifesciences',898,'Pharma','small'],
  ['METROPOLIS','Metropolis Healthcare',1748,'Healthcare','small'],
  ['KIMS','KIMS Hospitals',2298,'Healthcare','small'],
  ['RAINBOW','Rainbow Children Med',1398,'Healthcare','small'],
  ['NUVOCO','Nuvoco Vistas Corp',348,'Cement','small'],
  ['JKCEMENT','JK Cement',4280,'Cement','small'],
  ['HEIDELBERG','HeidelbergCement',198,'Cement','small'],
  ['JKLAKSHMI','JK Lakshmi Cement',798,'Cement','small'],
  ['INOXWIND','Inox Wind',198,'Utilities','small'],
  ['WIND','Inox Wind Energy',148,'Utilities','small'],
  ['KPRMILL','KPR Mill',898,'Textile','small'],
  ['ARVIND','Arvind Ltd',298,'Textile','small'],
  ['VARDHMAN','Vardhman Textiles',498,'Textile','small'],
  ['TRIDENT','Trident Ltd',38,'Textile','small'],
  ['WELSPUNIND','Welspun India',148,'Textile','small'],
  ['SWARAJENG','Swaraj Engines',2648,'Auto','small'],
  ['SUPRAJIT','Suprajit Engineering',398,'Auto','small'],
  ['MINDA','Minda Corporation',498,'Auto','small'],
  ['ENDURANCE','Endurance Technologies',2448,'Auto','small'],
  ['CRAFTSMAN','Craftsman Automation',4980,'Auto','small'],
  ['CARTRADE','CarTrade Tech',898,'Internet','small'],
  ['EASEMYTRIP','EaseMyTrip',28,'Internet','small'],
  ['MAPMYINDIA','MapMyIndia (CE Info)',1648,'Internet','small'],
  ['POLICYBZR','PB Fintech (PolicyBazaar)',1648,'Internet','small'],
  ['PAYTM','One 97 Communications',748,'Internet','small'],
  ['NYKAA','FSN E-Commerce (Nykaa',198,'Internet','small'],
];

// Seeded pseudo-random so a scan is reproducible within a session
let _seed = Date.now() % 100000;
function rand(){ _seed = (_seed*1103515245+12345)&0x7fffffff; return _seed/0x7fffffff; }

/* ===========================================================================
   LIVE DATA CONFIG  —  ★ THE ONE LINE YOU EDIT ★
   ---------------------------------------------------------------------------
   After you deploy the Cloudflare Worker (worker.js), paste its URL here.
   Example: 'https://intraday-data.yourname.workers.dev'
   Leave it as '' to keep running on demo data.
=========================================================================== */
/* ===========================================================================
   LIVE DATA CONFIG — auto-detected when served by the Cloudflare Worker.
   If opening as a local file, paste your Worker URL below instead.
=========================================================================== */
const LIVE_DATA_URL = (typeof window !== 'undefined' && window.location.protocol === 'https:')
  ? window.location.origin   // served by Worker — use same origin, no CORS issues
  : 'https://intraday-data.arunlovesmessi10.workers.dev';  // fallback for local use

const DataAdapter = {
  // demo generator — used when LIVE_DATA_URL is blank, or as fallback
  demo(stock){
    const [sym,name,base,sector,capSize='large']=stock;
    const candles=[]; let price=base*(0.985+rand()*0.03);
    const drift=(rand()-0.5)*0.0009;
    const vol=base*(0.002+rand()*0.006);
    for(let i=0;i<90;i++){
      const o=price;
      const move=(rand()-0.5)*vol*2 + price*drift;
      const c=Math.max(0.5,o+move);
      const h=Math.max(o,c)+rand()*vol*0.7;
      const l=Math.min(o,c)-rand()*vol*0.7;
      const v=Math.round((50000+rand()*900000)*(1+(Math.abs(move)/vol)));
      candles.push({o,h,l,c,v}); price=c;
    }
    return {sym,name,base,sector,capSize,candles,news:NewsEngine.sample(sym,sector),
      _source:'demo'};
  },

  // live fetch via the Cloudflare Worker proxy
  async fetchLive(stock){
    const [sym,name,base,sector,capSize='large']=stock;
    try{
      const r=await fetch(\`\${LIVE_DATA_URL}/?symbol=\${encodeURIComponent(sym)}\`);
      if(!r.ok) throw new Error('Worker HTTP '+r.status);
      const d=await r.json();
      if(!d.ok) throw new Error(d.error||'Worker returned ok:false');
      if(!d.candles) throw new Error('No candles array in response');
      // Strip bad bars — zero volume, zero/null price, or NaN values
      const clean=d.candles.filter(c=>
        c.o>0 && c.h>0 && c.l>0 && c.c>0 &&
        c.v>=0 &&
        isFinite(c.o)&&isFinite(c.h)&&isFinite(c.l)&&isFinite(c.c));
      if(clean.length<30) throw new Error(\`Only \${clean.length} valid candles (need 30+)\`);
      return {sym,name,base:d.meta?.ltp||base,sector,capSize,
        candles:clean,news:NewsEngine.sample(sym,sector),
        _source:'live'};
    }catch(e){
      const demo=this.demo(stock);
      demo._source='demo-fallback';
      demo._err=String(e.message||e);
      return demo;
    }
  },

  // unified entry point used by runScan
  async fetch(stock){
    if(LIVE_DATA_URL) return this.fetchLive(stock);
    return this.demo(stock);
  }
};

/* ---------- 2. INDICATOR LIBRARY (pure math) ------------------------------ */
const TA = {
  sma(a,p){const o=[];for(let i=0;i<a.length;i++){if(i<p-1){o.push(null);continue;}
    let s=0;for(let j=0;j<p;j++)s+=a[i-j];o.push(s/p);}return o;},
  ema(a,p){const o=[];const k=2/(p+1);let prev;
    for(let i=0;i<a.length;i++){if(i===0){prev=a[0];o.push(prev);continue;}
      prev=a[i]*k+prev*(1-k);o.push(prev);}return o;},
  rsi(c,p=14){const o=[];let g=0,l=0;
    for(let i=1;i<c.length;i++){const d=c[i]-c[i-1];
      if(i<=p){d>=0?g+=d:l-=d;if(i===p){g/=p;l/=p;o.length=p;o.fill(null);
        o[p]=100-100/(1+g/(l||1e-9));}}
      else{g=(g*(p-1)+(d>0?d:0))/p;l=(l*(p-1)+(d<0?-d:0))/p;
        o[i]=100-100/(1+g/(l||1e-9));}}
    o[0]=null;return o;},
  macd(c){const e12=TA.ema(c,12),e26=TA.ema(c,26);
    const line=c.map((_,i)=>e12[i]-e26[i]);
    const sig=TA.ema(line,9);
    return{line,sig,hist:line.map((v,i)=>v-sig[i])};},
  vwap(cd){const o=[];let cumPV=0,cumV=0;
    for(let i=0;i<cd.length;i++){const tp=(cd[i].h+cd[i].l+cd[i].c)/3;
      cumPV+=tp*cd[i].v;cumV+=cd[i].v;o.push(cumPV/cumV);}return o;},
  atr(cd,p=14){const tr=[];
    for(let i=0;i<cd.length;i++){if(i===0){tr.push(cd[i].h-cd[i].l);continue;}
      tr.push(Math.max(cd[i].h-cd[i].l,Math.abs(cd[i].h-cd[i-1].c),
        Math.abs(cd[i].l-cd[i-1].c)));}
    return TA.ema(tr,p);},
  adx(cd,p=14){const plusDM=[],minusDM=[],tr=[];
    for(let i=1;i<cd.length;i++){const up=cd[i].h-cd[i-1].h,dn=cd[i-1].l-cd[i].l;
      plusDM.push(up>dn&&up>0?up:0);minusDM.push(dn>up&&dn>0?dn:0);
      tr.push(Math.max(cd[i].h-cd[i].l,Math.abs(cd[i].h-cd[i-1].c),
        Math.abs(cd[i].l-cd[i-1].c)));}
    const sTR=TA.ema(tr,p),sP=TA.ema(plusDM,p),sM=TA.ema(minusDM,p);
    const dx=sTR.map((t,i)=>{const pdi=100*sP[i]/(t||1e-9),mdi=100*sM[i]/(t||1e-9);
      return 100*Math.abs(pdi-mdi)/((pdi+mdi)||1e-9);});
    return TA.ema(dx,p);},
  bollinger(c,p=20,m=2){const mid=TA.sma(c,p);const up=[],lo=[];
    for(let i=0;i<c.length;i++){if(i<p-1){up.push(null);lo.push(null);continue;}
      let s=0;for(let j=0;j<p;j++)s+=(c[i-j]-mid[i])**2;
      const sd=Math.sqrt(s/p);up.push(mid[i]+m*sd);lo.push(mid[i]-m*sd);}
    return{mid,up,lo};},
  stochastic(cd,p=14){const k=[];
    for(let i=0;i<cd.length;i++){if(i<p-1){k.push(null);continue;}
      let hi=-1e9,lo=1e9;for(let j=0;j<p;j++){hi=Math.max(hi,cd[i-j].h);
        lo=Math.min(lo,cd[i-j].l);}
      k.push(100*(cd[i].c-lo)/((hi-lo)||1e-9));}
    return{k,d:TA.sma(k.filter(x=>x!=null).length?k.map(x=>x??0):k,3)};},
  supertrend(cd,p=10,mult=3){const atr=TA.atr(cd,p);const st=[];let dir=1,prev;
    for(let i=0;i<cd.length;i++){const hl=(cd[i].h+cd[i].l)/2;
      const ub=hl+mult*atr[i],lb=hl-mult*atr[i];
      if(i===0){prev=lb;st.push({v:lb,dir:1});continue;}
      if(cd[i].c>prev&&dir<0)dir=1;else if(cd[i].c<prev&&dir>0)dir=-1;
      prev=dir>0?Math.max(lb,prev):Math.min(ub,prev);
      st.push({v:prev,dir});}
    return st;}
};

/* ---------- 3. NEWS ENGINE (keyword sentiment, no LLM) -------------------- */
const NewsEngine = {
  POS:['surge','jump','beat','record','profit','upgrade','order win','expansion',
    'rally','strong','growth','dividend','bullish','outperform','acquisition','buyback'],
  NEG:['fall','drop','miss','loss','downgrade','probe','fraud','weak','cut',
    'lawsuit','bearish','underperform','default','penalty','resignation','recall'],
  HEADLINES:{
    pos:['{S} posts better-than-expected quarterly numbers, margins expand',
      '{S} wins large {sector} order; brokerages raise target price',
      'Block deal lifts {S}; analysts turn bullish on near-term momentum',
      '{S} announces capacity expansion, management guides strong outlook'],
    neg:['{S} slips after brokerage downgrade citing valuation concerns',
      'Weak {sector} demand weighs on {S}; Q-numbers miss estimates',
      '{S} under pressure as promoters trim stake in bulk deal',
      'Regulatory probe headlines drag {S} lower in early trade'],
    neu:['{S} trades flat ahead of {sector} sector data due this week',
      'No major triggers for {S}; volumes in line with 20-day average',
      '{S} consolidates near key levels; traders await market cues']},
  classify(text){
    const t=text.toLowerCase();let s=0;
    this.POS.forEach(w=>{if(t.includes(w))s++;});
    this.NEG.forEach(w=>{if(t.includes(w))s--;});
    return s>0?'pos':s<0?'neg':'neu';
  },
  sample(sym,sector){
    const n=Math.floor(rand()*3);const out=[];const buckets=['pos','neg','neu'];
    for(let i=0;i<=n;i++){
      const b=buckets[Math.floor(rand()*3)];
      const tpl=this.HEADLINES[b][Math.floor(rand()*this.HEADLINES[b].length)];
      const txt=tpl.replace('{S}',sym).replace('{sector}',sector.toLowerCase());
      out.push({text:txt,sentiment:this.classify(txt),
        ago:Math.floor(rand()*340)+5,
        src:['Mint','ET Markets','Moneycontrol','Bloomberg'][Math.floor(rand()*4)]});
    }
    return out;
  },

  /* --- OPTIONAL AI SENTIMENT (the ONLY AI call in the whole system) ---------
     Re-classifies ALL headlines from the current scan in ONE batched request,
     so token cost is ~1 call per scan regardless of stock count.
     - Inside Claude.ai: the in-artifact API works with no key.
     - Self-hosting: add  'x-api-key': 'YOUR_KEY'  to the headers below and set
       'anthropic-version':'2023-06-01'. Never expose a real key in a public page.
     - On ANY failure it returns null and the keyword classifier is used instead,
       so the system never breaks and never blocks.
  ------------------------------------------------------------------------- */
  aiEnabled:false,            // flips true after a successful AI run
  async aiClassifyBatch(items){
    // items: [{id, text}]  ->  resolves to { id: 'pos'|'neg'|'neu', ... } or null
    if(!items.length) return {};
    const list=items.map(x=>\`\${x.id}: \${x.text}\`).join('\\n');
    const prompt=
      \`You are a financial news sentiment classifier for Indian intraday traders.\\n\`+
      \`For EACH headline below, judge its short-term impact on that stock's price.\\n\`+
      \`Reply with ONLY a JSON object mapping each id to "pos", "neg", or "neu". \`+
      \`No markdown, no commentary.\\n\\nHeadlines:\\n\${list}\`;
    try{
      const res=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'claude-sonnet-4-20250514',
          max_tokens:1000,
          messages:[{role:'user',content:prompt}]
        })
      });
      if(!res.ok) throw new Error('HTTP '+res.status);
      const data=await res.json();
      let txt=data.content.filter(b=>b.type==='text').map(b=>b.text).join('');
      txt=txt.replace(/\`\`\`json|\`\`\`/g,'').trim();
      const map=JSON.parse(txt);
      // sanitise: only accept known labels
      const clean={};
      Object.keys(map).forEach(k=>{
        const v=String(map[k]).toLowerCase();
        clean[k]=['pos','neg','neu'].includes(v)?v:'neu';
      });
      return clean;
    }catch(e){
      console.warn('AI sentiment unavailable, using keyword fallback:',e.message);
      return null;          // -> caller keeps keyword sentiment
    }
  }
};

/* ---------- 4. SCORING ENGINE --------------------------------------------- */
/* Each indicator votes LONG / SHORT / NEUTRAL with a weight. Confidence is the
   net weighted agreement, scaled 0-100. Conflict between indicators is
   penalised. Extra rule-gates (ADX, R:R, news, time) adjust the final pick.

   WEIGHTS are tunable — the backtest engine adjusts these based on real
   historical performance. Saved to localStorage between sessions.          */
const BASE_WEIGHTS={rsi:16,macd:18,ema:16,vwap:18,volume:10,adx:8,boll:8,stoch:6};
let WEIGHTS={...BASE_WEIGHTS};

// Load tuned weights from a previous backtest if available
try{
  const saved=localStorage.getItem('ie_weights');
  if(saved){ const w=JSON.parse(saved);
    if(Object.keys(w).length===Object.keys(BASE_WEIGHTS).length) WEIGHTS=w; }
}catch(e){}

// Nifty broad-market state — fetched once per scan
let MARKET_TREND='flat';   // 'up' | 'down' | 'flat'
let MARKET_CHANGE=0;

async function fetchMarketTrend(){
  try{
    const r=await fetch(\`\${LIVE_DATA_URL}/?symbol=NIFTY50&mode=index\`);
    const d=await r.json();
    if(d.ok){ MARKET_TREND=d.trend; MARKET_CHANGE=d.change; }
  }catch(e){ MARKET_TREND='flat'; }
}

function lastValid(arr){for(let i=arr.length-1;i>=0;i--)if(arr[i]!=null)return arr[i];return null;}

function analyze(data){
  const cd=data.candles;const c=cd.map(x=>x.c);const n=cd.length-1;
  const ltp=c[n];const prevClose=cd[0].o;
  const chgPct=((ltp-prevClose)/prevClose)*100;

  // ---- compute indicators ----
  const rsi=TA.rsi(c);            const rsiV=lastValid(rsi);
  const macd=TA.macd(c);          const macdHist=macd.hist[n];const macdHistPrev=macd.hist[n-1];
  const ema9=TA.ema(c,9);         const ema21=TA.ema(c,21);
  const vwap=TA.vwap(cd);         const vwapV=vwap[n];
  const atr=TA.atr(cd);           const atrV=lastValid(atr);
  const adx=TA.adx(cd);           const adxV=lastValid(adx)||0;
  const boll=TA.bollinger(c);     const stoch=TA.stochastic(cd);const stochK=lastValid(stoch.k);
  const st=TA.supertrend(cd);     const stNow=st[n];
  const vol=cd[n].v;
  const avgVol=cd.slice(-20).reduce((s,x)=>s+x.v,0)/20;
  const volRatio=vol/avgVol;

  // ---- indicator votes: {dir:+1/-1/0, label, detail, weight} ----
  const votes=[];
  // RSI
  let rd=0,rlab='Neutral';
  if(rsiV<32){rd=1;rlab='Oversold — rebound bias';}
  else if(rsiV>68){rd=-1;rlab='Overbought — pullback bias';}
  else if(rsiV>50){rd=0.4;rlab='Above 50 — mild bullish';}
  else{rd=-0.4;rlab='Below 50 — mild bearish';}
  votes.push({name:'RSI (14)',dir:rd,val:rsiV.toFixed(1),label:rlab,wt:WEIGHTS.rsi});
  // MACD
  let md=macdHist>0?1:-1;
  const mLab=macdHist>0
    ?(macdHist>macdHistPrev?'Bullish & strengthening':'Bullish but fading')
    :(macdHist<macdHistPrev?'Bearish & strengthening':'Bearish but fading');
  if((macdHist>0)!==(macdHistPrev>0)) md*=1.0; // fresh crossover keeps full weight
  votes.push({name:'MACD (12,26,9)',dir:md*(Math.abs(macdHist)>Math.abs(macdHistPrev)?1:0.7),
    val:macdHist.toFixed(2),label:mLab,wt:WEIGHTS.macd});
  // EMA crossover
  const emaDir=ema9[n]>ema21[n]?1:-1;
  const emaGap=((ema9[n]-ema21[n])/ema21[n])*100;
  votes.push({name:'EMA 9/21 Cross',dir:emaDir,val:(emaGap>=0?'+':'')+emaGap.toFixed(2)+'%',
    label:emaDir>0?'9-EMA above 21-EMA — uptrend':'9-EMA below 21-EMA — downtrend',
    wt:WEIGHTS.ema});
  // VWAP
  const vwapDir=ltp>vwapV?1:-1;
  const vwapGap=((ltp-vwapV)/vwapV)*100;
  votes.push({name:'VWAP',dir:vwapDir,val:vwapV.toFixed(2),
    label:vwapDir>0?'Price above VWAP — buyers control':'Price below VWAP — sellers control',
    wt:WEIGHTS.vwap});
  // Volume
  let vd=0,vlab='Average volume';
  if(volRatio>1.5){vd=emaDir;vlab='High volume confirms move';}
  else if(volRatio<0.7){vd=0;vlab='Thin volume — weak conviction';}
  else{vd=emaDir*0.4;vlab='Volume in normal range';}
  votes.push({name:'Volume vs 20-avg',dir:vd,val:volRatio.toFixed(2)+'x',label:vlab,wt:WEIGHTS.volume});
  // ADX (strength only — sign follows EMA trend)
  const adxDir=adxV>20?emaDir*Math.min(1,(adxV-20)/25):0;
  votes.push({name:'ADX (14)',dir:adxDir,val:adxV.toFixed(1),
    label:adxV<20?'Weak trend — choppy':adxV<35?'Moderate trend strength':'Strong trend',
    wt:WEIGHTS.adx});
  // Bollinger
  let bd=0,blab='Mid-band — neutral';
  if(ltp<=boll.lo[n]){bd=1;blab='At lower band — mean-reversion up';}
  else if(ltp>=boll.up[n]){bd=-1;blab='At upper band — stretched';}
  else if(ltp>boll.mid[n]){bd=0.3;blab='Upper half of band';}
  else{bd=-0.3;blab='Lower half of band';}
  votes.push({name:'Bollinger (20,2)',dir:bd,val:boll.mid[n]?boll.mid[n].toFixed(2):'—',
    label:blab,wt:WEIGHTS.boll});
  // Stochastic
  let sd=0,slab='Neutral zone';
  if(stochK<20){sd=1;slab='Oversold';}
  else if(stochK>80){sd=-1;slab='Overbought';}
  else{sd=stochK>50?0.3:-0.3;slab=stochK>50?'Above midpoint':'Below midpoint';}
  votes.push({name:'Stochastic (14,3)',dir:sd,val:stochK.toFixed(1),label:slab,wt:WEIGHTS.stoch});

  // ---- aggregate ----
  let netW=0,totalW=0,bullW=0,bearW=0;
  votes.forEach(v=>{netW+=v.dir*v.wt;totalW+=v.wt;
    if(v.dir>0)bullW+=v.dir*v.wt;if(v.dir<0)bearW+=-v.dir*v.wt;});
  const side=netW>=0?'long':'short';
  // raw conviction 0..1
  const conviction=Math.abs(netW)/totalW;
  // conflict penalty: how much weight opposed the chosen side
  const opposed=side==='long'?bearW:bullW;
  const conflictPenalty=opposed/totalW;            // 0..1
  let confidence=Math.round((conviction*(1-conflictPenalty*0.55))*100);

  // ---- RULE GATES ----
  const gates=[];
  // Gate 1: trend-strength filter
  if(adxV<20){confidence=Math.round(confidence*0.7);
    gates.push({t:'ADX < 20 — choppy market, confidence reduced',k:'neg'});}
  // Gate 2: news override
  const news=data.news||[];
  const negNews=news.filter(x=>x.sentiment==='neg').length;
  const posNews=news.filter(x=>x.sentiment==='pos').length;
  if(side==='long'&&negNews>posNews&&negNews>0){
    confidence=Math.min(confidence,55);
    gates.push({t:'Negative news flow caps a long-side score',k:'neg'});}
  if(side==='short'&&posNews>negNews&&posNews>0){
    confidence=Math.min(confidence,55);
    gates.push({t:'Positive news flow caps a short-side score',k:'neg'});}
  if(side==='long'&&posNews>0&&posNews>=negNews){
    confidence=Math.min(99,confidence+4);
    gates.push({t:'Supportive news flow — small confidence boost',k:'pos'});}
  // Gate 3: time-of-day
  const sess=marketSession();
  if(sess.phase==='open-volatile'){
    confidence=Math.round(confidence*0.92);
    gates.push({t:'First 30 min — higher noise, confidence trimmed',k:'info'});}
  if(sess.phase==='close-volatile'){
    gates.push({t:'Final 30 min — square-off volatility, trade light',k:'info'});}
  // Gate 4: Nifty broad-market gate
  if(!data._btMode){   // skip during backtest (each day has its own market context)
    if(MARKET_TREND==='down'&&side==='long'){
      confidence=Math.round(confidence*0.80);
      gates.push({t:\`Nifty is DOWN \${Math.abs(MARKET_CHANGE).toFixed(2)}% today — long signals penalised\`,k:'neg'});}
    if(MARKET_TREND==='up'&&side==='short'){
      confidence=Math.round(confidence*0.80);
      gates.push({t:\`Nifty is UP \${MARKET_CHANGE.toFixed(2)}% today — short signals penalised\`,k:'neg'});}
    if(MARKET_TREND==='up'&&side==='long'){
      confidence=Math.min(99,confidence+5);
      gates.push({t:\`Nifty is UP \${MARKET_CHANGE.toFixed(2)}% — broad market supports longs\`,k:'pos'});}
  }

  confidence=Math.max(5,Math.min(99,confidence));

  // ---- TRADE PLAN (ATR-based) ----
  const riskMult=1.3, rewardMult=2.4;            // R:R ≈ 1.85 target
  let entry,stop,t1,t2;
  if(side==='long'){
    entry=ltp;
    stop=ltp-atrV*riskMult;
    t1=ltp+atrV*rewardMult*0.6;
    t2=ltp+atrV*rewardMult;
  }else{
    entry=ltp;
    stop=ltp+atrV*riskMult;
    t1=ltp-atrV*rewardMult*0.6;
    t2=ltp-atrV*rewardMult;
  }
  const risk=Math.abs(entry-stop);
  const reward=Math.abs(t2-entry);
  const rr=reward/risk;
  // Gate 4: R:R filter
  const rrPass=rr>=1.5;
  if(!rrPass)gates.push({t:'Risk:Reward below 1.5 — pick suppressed',k:'neg'});
  // position sizing — 1% of ₹1,00,000 demo capital
  const capital=100000, riskPerTrade=capital*0.01;
  const qty=Math.max(1,Math.floor(riskPerTrade/risk));
  // ATR as % of price — volatility fingerprint shown on card
  const atrPct=(atrV/ltp)*100;

  return {
    ...data, ltp, chgPct, side, confidence, votes, gates,
    rrPass, news, sector:data.sector, atrPct,
    metrics:{rsiV,adxV,atrV,atrPct,vwapV,volRatio,emaGap},
    plan:{entry,stop,t1,t2,risk,reward,rr,qty,capital,riskPerTrade},
    bullW,bearW,totalW
  };
}

/* ---------- 5. MARKET SESSION -------------------------------------------- */
function marketSession(){
  const now=new Date();
  const d=now.getDay();                 // 0 Sun .. 6 Sat
  const mins=now.getHours()*60+now.getMinutes();
  const open=9*60+15, close=15*60+30;
  if(d===0||d===6) return {phase:'closed',label:'CLOSED · WEEKEND',open:false};
  if(mins<open) return {phase:'pre',label:'PRE-OPEN',open:false};
  if(mins>close) return {phase:'post',label:'CLOSED',open:false};
  if(mins<open+30) return {phase:'open-volatile',label:'OPEN · VOLATILE',open:true};
  if(mins>close-30) return {phase:'close-volatile',label:'OPEN · SQUARE-OFF',open:true};
  return {phase:'open',label:'OPEN',open:true};
}

/* ---------- 6. PRICE CATEGORIES ------------------------------------------ */
const CATEGORIES=[
  {id:'c1',label:'Under ₹500',tag:'PENNY–MID',min:0,max:500},
  {id:'c2',label:'₹500 – ₹1,000',tag:'MID',min:500,max:1000},
  {id:'c3',label:'₹1,000 – ₹2,000',tag:'MID–LARGE',min:1000,max:2000},
  {id:'c4',label:'₹2,000 – ₹5,000',tag:'LARGE',min:2000,max:5000},
  {id:'c5',label:'Above ₹5,000',tag:'PREMIUM',min:5000,max:1e9},
];

/* ---------- 7. RENDER LAYER ---------------------------------------------- */
let RESULTS=[];
let sortMode='conf';        // conf | change
let sideFilter='all';       // all | long | short
let capFilter='all';        // all | large | mid | small
let confFilter='all';       // all | below50 | 50-60 | 60-70 | above70

const fmt=n=>n>=1000?n.toLocaleString('en-IN',{maximumFractionDigits:2})
  :n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});

function confColor(c){
  if(c>=70)return 'var(--green)';
  if(c>=50)return 'var(--amber)';
  return 'var(--red)';
}
function confLabel(c){
  if(c>=80)return 'HIGH CONVICTION';
  if(c>=65)return 'GOOD';
  if(c>=50)return 'MODERATE';
  if(c>=35)return 'LOW — WATCH ONLY';
  return 'VERY LOW — AVOID';
}

async function runScan(){
  _seed=(Date.now()%100000)+Math.floor(Math.random()*9999);
  const btn=document.getElementById('scanBtn');
  const note=document.getElementById('scanNote');
  btn.disabled=true; btn.textContent='⟳ SCANNING…';
  note.textContent=LIVE_DATA_URL?'Fetching live data + Nifty…':'Generating demo data…';
  // fetch Nifty trend AND all stocks in parallel
  const [_, ...stockData] = await Promise.all([
    LIVE_DATA_URL ? fetchMarketTrend() : Promise.resolve(),
    ...UNIVERSE.map(s=>DataAdapter.fetch(s))
  ]);
  RESULTS=stockData.map(d=>analyze(d));
  const t=new Date();
  const live=RESULTS.filter(r=>r._source==='live').length;
  const failed=RESULTS.filter(r=>r._source==='demo-fallback');
  // surface the first unique error reason so it's visible
  const errReasons=[...new Set(failed.map(r=>r._err).filter(Boolean))].slice(0,2);
  let src;
  if(!LIVE_DATA_URL) src='DEMO DATA';
  else if(live===RESULTS.length) src=\`LIVE ✓ · Nifty \${MARKET_TREND.toUpperCase()} \${MARKET_CHANGE>0?'+':''}\${MARKET_CHANGE}%\`;
  else if(live>0) src=\`LIVE \${live}/\${RESULTS.length} · \${failed.length} fallback\${errReasons.length?' ('+errReasons[0]+')':''}\`;
  else src='ALL FALLBACK — '+( errReasons[0]||'check Worker');
  note.textContent='Last scan: '+t.toLocaleTimeString('en-IN',{hour12:false})+' · '+src;
  btn.disabled=false; btn.textContent='⟳ RUN SCAN';
  render();
}

function render(){
  // summary strip
  const tradable=RESULTS.filter(r=>r.rrPass&&r.confidence>=50);
  const longs=tradable.filter(r=>r.side==='long').length;
  const shorts=tradable.filter(r=>r.side==='short').length;
  const top=[...RESULTS].sort((a,b)=>b.confidence-a.confidence)[0];
  const nLarge=RESULTS.filter(r=>r.capSize==='large').length;
  const nMid=RESULTS.filter(r=>r.capSize==='mid').length;
  const nSmall=RESULTS.filter(r=>r.capSize==='small').length;
  const highConv=RESULTS.filter(r=>r.confidence>=70&&r.rrPass).length;
  const mktLean=longs>shorts?'BULLISH':longs<shorts?'BEARISH':'NEUTRAL';
  const mktLeanColor=longs>shorts?'var(--green)':longs<shorts?'var(--red)':'var(--muted)';
  document.getElementById('strip').innerHTML=\`
    <div class="stat"><div class="k">Actionable Picks</div>
      <div class="v">\${tradable.length}<small> / \${RESULTS.length} scanned</small></div>
      <div style="font-size:10px;color:var(--faint);margin-top:3px;font-family:var(--mono)">passed R:R ≥ 1.5 &amp; conf ≥ 50%</div></div>
    <div class="stat"><div class="k">Long / Short Bias</div>
      <div class="v"><span class="up">\${longs}▲</span> <small style="color:var(--faint)"> vs </small><span class="down">\${shorts}▼</span></div>
      <div style="font-size:10px;color:\${mktLeanColor};margin-top:3px;font-family:var(--mono);font-weight:700">\${mktLean}</div></div>
    <div class="stat"><div class="k">Top Confidence Pick</div>
      <div class="v" style="color:\${confColor(top.confidence)}">\${top.confidence}%
        <small>\${top.sym}</small></div>
      <div style="font-size:10px;color:var(--faint);margin-top:3px;font-family:var(--mono)">\${highConv} picks ≥ 70% conf</div></div>
    <div class="stat"><div class="k">Universe: Large · Mid · Small</div>
      <div class="v"><span style="color:#6aa3ff">\${nLarge}</span><small style="color:var(--faint)"> · </small>
        <span style="color:#b87aff">\${nMid}</span><small style="color:var(--faint)"> · </small>
        <span style="color:#ffb020">\${nSmall}</span></div>
      <div style="font-size:10px;color:var(--faint);margin-top:3px;font-family:var(--mono)">\${RESULTS.length} total — all cap sizes</div></div>\`;

  // categories
  const host=document.getElementById('categories');host.innerHTML='';
  CATEGORIES.forEach(cat=>{
    let picks=RESULTS.filter(r=>r.ltp>=cat.min&&r.ltp<cat.max&&r.rrPass);
    if(sideFilter!=='all') picks=picks.filter(r=>r.side===sideFilter);
    if(capFilter!=='all')  picks=picks.filter(r=>(r.capSize||'large')===capFilter);
    if(confFilter==='below50')  picks=picks.filter(r=>r.confidence<50);
    else if(confFilter==='50-60') picks=picks.filter(r=>r.confidence>=50&&r.confidence<60);
    else if(confFilter==='60-70') picks=picks.filter(r=>r.confidence>=60&&r.confidence<70);
    else if(confFilter==='above70') picks=picks.filter(r=>r.confidence>=70);
    picks.sort((a,b)=> sortMode==='conf'
      ? b.confidence-a.confidence
      : Math.abs(b.chgPct)-Math.abs(a.chgPct));
    const sec=document.createElement('div');sec.className='cat';
    sec.innerHTML=\`<div class="cat-hd">
      <h2>\${cat.label}</h2><span class="tag">\${cat.tag}</span>
      <div class="rule"></div><span class="count">\${picks.length} picks</span></div>\`;
    if(picks.length===0){
      sec.innerHTML+=\`<div class="empty">No qualifying picks in this price band right now.</div>\`;
    }else{
      const g=document.createElement('div');g.className='grid';
      picks.forEach(p=>g.appendChild(card(p)));
      sec.appendChild(g);
    }
    host.appendChild(sec);
  });
}

function card(p){
  const el=document.createElement('div');
  el.className='card '+p.side;
  const chgCls=p.chgPct>=0?'up':'down';
  const atrPct=p.atrPct||0;
  const volCls=atrPct<0.8?'low':atrPct<1.8?'med':'high';
  const volLabel=atrPct<0.8?'LOW VOL':atrPct<1.8?'MED VOL':'HIGH VOL';
  el.innerHTML=\`
    <div class="side-bar"></div>
    <div class="c-top">
      <div>
        <div class="c-sym">\${p.sym}<span class="cap-badge \${p.capSize||'large'}">\${(p.capSize||'large').toUpperCase()}</span><span class="vol-badge \${volCls}">\${volLabel}</span></div>
        <div class="c-name">\${p.name} · \${p.sector}</div>
      </div>
      <div class="c-ltp"><div class="price">₹\${fmt(p.ltp)}</div>
        <div class="chg \${chgCls}">\${p.chgPct>=0?'▲':'▼'} \${Math.abs(p.chgPct).toFixed(2)}%</div></div>
    </div>
    <div class="c-mid">
      <span class="signal \${p.side}">\${p.side==='long'?'▲ LONG':'▼ SHORT'}</span>
      <div class="conf">
        <div class="conf-row"><span>CONFIDENCE</span><b>\${p.confidence}%</b></div>
        <div class="bar"><div style="width:\${p.confidence}%;background:\${confColor(p.confidence)}"></div></div>
      </div>
    </div>
    <div class="c-levels">
      <div class="lv entry"><div class="lk">Entry</div><div class="lv-v">\${fmt(p.plan.entry)}</div></div>
      <div class="lv target"><div class="lk">Target 2</div><div class="lv-v">\${fmt(p.plan.t2)}</div></div>
      <div class="lv stop"><div class="lk">Stop Loss</div><div class="lv-v">\${fmt(p.plan.stop)}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--line);margin-top:8px;font-family:var(--mono);font-size:10px;color:var(--faint)">
      <span>R:R <b style="color:var(--ink)">\${p.plan.rr.toFixed(2)}</b></span>
      <span>ATR% <b style="color:var(--ink)">\${atrPct.toFixed(2)}%</b></span>
      <span>Vol <b style="color:var(--ink)">\${p.metrics.volRatio.toFixed(1)}x</b></span>
      <span>ADX <b style="color:var(--ink)">\${p.metrics.adxV.toFixed(0)}</b></span>
    </div>\`;
  el.onclick=()=>openDetail(p.sym);
  return el;
}

/* ---------- 8. DETAIL PAGE ----------------------------------------------- */
function openDetail(sym){
  const p=RESULTS.find(r=>r.sym===sym);if(!p)return;
  const m=document.getElementById('modal');
  // reasons — derived from votes + gates, human readable
  const reasons=[];
  p.votes.filter(v=>Math.abs(v.dir)>=0.4).sort((a,b)=>Math.abs(b.dir*b.wt)-Math.abs(a.dir*a.wt))
    .slice(0,5).forEach(v=>{
      const agrees=(v.dir>0)===(p.side==='long');
      reasons.push({k:agrees?'pos':'neg',
        m:agrees?'✓':'✕',
        t:\`\${v.name}: \${v.label} (\${v.val})\`});
    });
  p.gates.forEach(g=>reasons.push({k:g.k,m:g.k==='pos'?'✓':g.k==='neg'?'✕':'ⓘ',t:g.t}));

  const indRows=p.votes.map(v=>{
    const agrees=(v.dir>0)===(p.side==='long')&&Math.abs(v.dir)>=0.4;
    const opp=(v.dir<0)===(p.side==='long')&&Math.abs(v.dir)>=0.4
      ||(v.dir>0)===(p.side==='short')&&Math.abs(v.dir)>=0.4;
    const cls=Math.abs(v.dir)<0.4?'neut':(agrees?'bull':'bear');
    const lab=Math.abs(v.dir)<0.4?'NEUTRAL':(agrees?'SUPPORTS':'OPPOSES');
    return \`<tr>
      <td class="ind-name">\${v.name}</td>
      <td class="ind-val">\${v.val}</td>
      <td><span class="pill \${cls}">\${lab}</span></td>
      <td class="ind-wt">\${v.wt}</td>
    </tr>\`;
  }).join('');

  const newsHtml=p.news.length? p.news.map(n=>\`
    <div class="news-item"><div class="nh">
      <div class="nt">\${n.text}</div>
      <span class="sent \${n.sentiment}">\${n.sentiment.toUpperCase()}</span></div>
      <div class="nmeta">\${n.src} · \${n.ago} min ago</div></div>\`).join('')
    : \`<div class="empty">No notable headlines in the scan window.</div>\`;

  const sess=marketSession();
  m.innerHTML=\`
    <div class="m-hd">
      <div><div class="m-sym">\${p.sym}
        <span class="signal \${p.side}" style="font-size:11px;vertical-align:3px">
        \${p.side==='long'?'▲ LONG':'▼ SHORT'}</span>
        <span class="cap-badge \${p.capSize||'large'}" style="font-size:10px">\${(p.capSize||'large').toUpperCase()} CAP</span></div>
        <div class="m-name">\${p.name} · \${p.sector} · ₹\${fmt(p.ltp)}
          <span class="\${p.chgPct>=0?'up':'down'}">
          \${p.chgPct>=0?'▲':'▼'}\${Math.abs(p.chgPct).toFixed(2)}%</span></div></div>
      <div class="x" onclick="closeDetail()">ESC ✕</div>
    </div>
    <div class="m-body">

      <div class="verdict">
        <div class="big-conf" style="color:\${confColor(p.confidence)}">\${p.confidence}%</div>
        <div class="vmeta">
          <div class="vl">\${confLabel(p.confidence)}</div>
          <div class="vd">\${verdictText(p)}</div>
        </div>
      </div>

      <div class="sec-t">▸ Trade Plan</div>
      <div class="plan">
        <div class="pcell"><div class="pk">Entry Zone</div>
          <div class="pv" style="color:var(--blue)">₹\${fmt(p.plan.entry)}</div>
          <div class="ps">at / near LTP</div></div>
        <div class="pcell"><div class="pk">Stop Loss</div>
          <div class="pv" style="color:var(--red)">₹\${fmt(p.plan.stop)}</div>
          <div class="ps">risk ₹\${fmt(p.plan.risk)}/sh</div></div>
        <div class="pcell"><div class="pk">Target 1</div>
          <div class="pv" style="color:var(--green)">₹\${fmt(p.plan.t1)}</div>
          <div class="ps">book 50% here</div></div>
        <div class="pcell"><div class="pk">Target 2</div>
          <div class="pv" style="color:var(--green)">₹\${fmt(p.plan.t2)}</div>
          <div class="ps">trail rest</div></div>
      </div>
      <div class="plan" style="margin-top:10px">
        <div class="pcell"><div class="pk">Risk : Reward</div>
          <div class="pv">1 : \${p.plan.rr.toFixed(2)}</div>
          <div class="ps">target 2 basis</div></div>
        <div class="pcell"><div class="pk">Suggested Qty</div>
          <div class="pv">\${p.plan.qty}</div>
          <div class="ps">1% risk of ₹\${(p.plan.capital/1000)}k</div></div>
        <div class="pcell"><div class="pk">Capital at Risk</div>
          <div class="pv">₹\${fmt(p.plan.riskPerTrade)}</div>
          <div class="ps">max loss if SL hit</div></div>
        <div class="pcell"><div class="pk">ATR (14)</div>
          <div class="pv">\${fmt(p.metrics.atrV)}</div>
          <div class="ps">volatility unit</div></div>
      </div>

      <div class="sec-t">▸ Why This Pick</div>
      <ul class="reason-list">
        \${reasons.map(r=>\`<li class="\${r.k}"><span class="mk">\${r.m}</span><span>\${r.t}</span></li>\`).join('')}
      </ul>

      <div class="sec-t">▸ Indicator Breakdown</div>
      <table class="ind-table">
        <thead><tr><th>Indicator</th><th>Value</th><th>Read</th><th>Weight</th></tr></thead>
        <tbody>\${indRows}</tbody>
      </table>

      <div class="sec-t">▸ News & Catalysts
        <span style="color:var(--faint);font-size:9px;letter-spacing:.6px">
        · \${NewsEngine.aiEnabled?'AI-CLASSIFIED':'KEYWORD-CLASSIFIED'}</span></div>
      \${newsHtml}

      <div class="sec-t">▸ Session Context</div>
      <ul class="reason-list">
        <li class="info"><span class="mk">ⓘ</span><span>Market status: <b>\${sess.label}</b>.
          \${sess.phase==='open-volatile'?'Opening volatility — wait for the first range to settle.':
            sess.phase==='close-volatile'?'Square-off window — avoid fresh positions.':
            sess.open?'Normal trading hours.':'Plan now, execute when market opens.'}</span></li>
        <li class="info"><span class="mk">ⓘ</span><span>Volume is
          <b>\${p.metrics.volRatio.toFixed(2)}x</b> the 20-bar average —
          \${p.metrics.volRatio>1.3?'strong participation backs this move.':
            p.metrics.volRatio<0.8?'thin volume; treat the signal with caution.':
            'participation is normal.'}</span></li>
        <li class="info"><span class="mk">ⓘ</span><span>ADX at
          <b>\${p.metrics.adxV.toFixed(1)}</b> —
          \${p.metrics.adxV<20?'trend is weak; this favours quick scalps over holds.':
            'trend strength is adequate to hold for the target.'}</span></li>
      </ul>

      <div class="disclaimer" style="margin:22px 0 4px">
        <b>⚠ Not advice.</b> Levels are model-generated from \${p.candles.length}
        \${p._source==='live'?'<b style="color:var(--green)">live</b> 5-min bars'
          :p._source==='demo-fallback'?'demo bars (live fetch failed for this stock)'
          :'demo bars'}.
        Always confirm the setup, never skip the stop-loss,
        and size positions to your own risk tolerance.
      </div>
    </div>\`;
  document.getElementById('overlay').classList.add('show');
  document.body.style.overflow='hidden';
}
function verdictText(p){
  const agree=p.votes.filter(v=>(v.dir>0)===(p.side==='long')&&Math.abs(v.dir)>=0.4).length;
  const total=p.votes.filter(v=>Math.abs(v.dir)>=0.4).length;
  const dir=p.side==='long'?'upside':'downside';
  if(p.confidence>=65)
    return \`\${agree} of \${total} active indicators align toward \${dir}. A clean, well-confirmed intraday setup — the strongest reads carry the most weight here.\`;
  if(p.confidence>=50)
    return \`Indicators lean \${dir} (\${agree}/\${total} active), but agreement is partial. Treat as a moderate-conviction trade and keep the stop tight.\`;
  return \`Signals are mixed (\${agree}/\${total} active aligned). Conviction is low — this is a watch-list candidate, not a high-confidence trade.\`;
}
function closeDetail(){
  document.getElementById('overlay').classList.remove('show');
  document.body.style.overflow='';
}
document.getElementById('overlay').onclick=e=>{
  if(e.target.id==='overlay')closeDetail();};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail();});

/* ---------- 9. CONTROLS + CLOCK ------------------------------------------ */
document.getElementById('scanBtn').onclick=runScan;
document.getElementById('backtestBtn').onclick=function(){
  if(!LIVE_DATA_URL){
    openBtModal(\`<div class="m-hd"><div><div class="m-sym">Backtest</div>
      <div class="m-name">Live data required</div></div>
      <div class="x" onclick="closeBt()">ESC ✕</div></div>
      <div class="m-body"><ul class="reason-list"><li class="neg"><span class="mk">✕</span>
      <span>Backtest requires live historical data from your Cloudflare Worker.
      The Worker URL is not set — still running in demo mode.</span></li></ul></div>\`);
    document.getElementById('btOverlay').classList.add('show');
    document.body.style.overflow='hidden';
    return;
  }
  runBacktest();
};
document.getElementById('sortConf').onclick=function(){
  sortMode=sortMode==='conf'?'change':'conf';
  this.textContent='SORT: '+(sortMode==='conf'?'CONFIDENCE':'% MOVE');render();};
document.getElementById('filterSide').onclick=function(){
  sideFilter=sideFilter==='all'?'long':sideFilter==='long'?'short':'all';
  this.textContent='SHOW: '+sideFilter.toUpperCase();render();};
document.getElementById('filterCap').onclick=function(){
  capFilter=capFilter==='all'?'large':capFilter==='large'?'mid':capFilter==='mid'?'small':'all';
  const labels={all:'ALL',large:'LARGE CAP',mid:'MID CAP',small:'SMALL CAP'};
  this.textContent='CAP: '+labels[capFilter];render();};
document.getElementById('filterConf').onclick=function(){
  const cycle={all:'below50','below50':'50-60','50-60':'60-70','60-70':'above70','above70':'all'};
  confFilter=cycle[confFilter]||'all';
  const labels={all:'ALL','below50':'< 50%','50-60':'50–60%','60-70':'60–70%','above70':'> 70%'};
  this.textContent='CONF: '+labels[confFilter];render();};

/* AI NEWS — one batched call re-classifies every headline in the scan,
   then re-runs scoring so news-gates reflect the AI sentiment. */
document.getElementById('aiNewsBtn').onclick=async function(){
  if(!RESULTS.length)return;
  const btn=this;const orig=btn.textContent;
  btn.textContent='⚡ ANALYSING…';btn.disabled=true;
  // collect every headline across the scan, tag with stable ids
  const items=[];
  RESULTS.forEach((r,ri)=>r.news.forEach((n,ni)=>
    items.push({id:\`s\${ri}_n\${ni}\`,text:n.text,_r:ri,_n:ni})));
  const map=await NewsEngine.aiClassifyBatch(items);
  if(map){
    items.forEach(it=>{
      if(map[it.id]) RESULTS[it._r].news[it._n].sentiment=map[it.id];
    });
    NewsEngine.aiEnabled=true;
    // re-run scoring so news override gates use the new sentiment
    RESULTS=RESULTS.map(r=>analyze({
      sym:r.sym,name:r.name,base:r.base,sector:r.sector,
      candles:r.candles,news:r.news,_source:r._source}));
    document.getElementById('scanNote').textContent+=' · AI news ✓';
    render();
    btn.textContent='⚡ AI NEWS ✓';
  }else{
    btn.textContent='⚡ AI N/A — KEYWORD';
    document.getElementById('scanNote').textContent+=' · AI unavailable';
  }
  btn.disabled=false;
  setTimeout(()=>{btn.textContent=orig;},3500);
};

function tickClock(){
  const now=new Date();
  document.getElementById('clockTime').textContent=
    now.toLocaleTimeString('en-IN',{hour12:false})+' IST';
  const s=marketSession();
  const el=document.getElementById('sessionState');
  el.textContent='MARKET · '+s.label;
  el.className='session '+(s.open?'open':'closed');
}
setInterval(tickClock,1000);tickClock();

/* ==========================================================================
   BACKTEST ENGINE
   --------------------------------------------------------------------------
   HOW IT WORKS:
   1. Fetches N days of 5-min historical data from the Worker for a sample
      of stocks (up to 10 to stay within rate limits).
   2. For each stock × each day D:
      - Splits candles into "signal day" (day D) and "outcome day" (day D+1)
      - Runs analyze() on signal day candles → generates a signal
      - Walks through outcome day candles bar-by-bar:
          * If high touches Target 1 first → T1_HIT
          * If high touches Target 2 → T2_HIT (full win)
          * If low touches Stop Loss  → LOSS
          * If neither by EOD         → OPEN (inconclusive)
   3. Computes per-indicator win-rate contribution and auto-tunes WEIGHTS.
   4. Displays results table + indicator performance + weight changes.

   KEY RULES:
   - Only signals with confidence ≥ 50% AND R:R ≥ 1.5 are tested
     (same filter as the dashboard — we only measure trades we'd actually take)
   - ALL 224 stocks in UNIVERSE are tested, not a fixed subset
   - 30 trading days of history (Yahoo's maximum for 5-min data)
   - Fetched in batches of 8 with a 600ms gap to respect Yahoo rate limits
   - Live progress bar shows stocks completed, signals found, time remaining
   ========================================================================== */

const BT_DAYS   = 30;    // trading days back (Yahoo 5-min limit ≈ 60 days)
const BT_BATCH  = 8;     // stocks per batch before pausing
const BT_DELAY  = 600;   // ms between batches
const BT_MIN_CONF = 50;  // minimum confidence to include a signal in backtest

async function runBacktest(){
  const btn=document.getElementById('backtestBtn');
  btn.disabled=true; btn.textContent='📊 RUNNING…';

  const total=UNIVERSE.length;
  openBtModal(
    \`<div style="padding:30px 24px;font-family:var(--mono);color:var(--muted)">
      <div style="font-size:14px;font-weight:700;color:var(--ink);margin-bottom:6px">
        📊 Running Backtest</div>
      <div style="font-size:11px;margin-bottom:16px">
        Testing ALL \${total} stocks · last \${BT_DAYS} trading days ·
        only signals with conf ≥ \${BT_MIN_CONF}% &amp; R:R ≥ 1.5</div>
      <div class="progress-wrap">
        <div class="progress-bar" id="btProgress" style="width:0%"></div></div>
      <div id="btProgressTxt" style="margin-top:10px;font-size:11px">
        Starting… 0 / \${total} stocks</div>
      <div id="btSignalTxt" style="margin-top:4px;font-size:11px;color:var(--faint)">
        0 actionable signals found so far</div>
    </div>\`);

  const allTrades=[];
  const indStats={};
  Object.keys(BASE_WEIGHTS).forEach(k=>indStats[k]={wins:0,total:0});

  for(let si=0;si<UNIVERSE.length;si++){
    const stock=UNIVERSE[si];
    const sym=stock[0];
    try{
      const r=await fetch(
        \`\${LIVE_DATA_URL}/?symbol=\${encodeURIComponent(sym)}&mode=history&days=\${BT_DAYS+4}\`);
      const d=await r.json();
      if(!d.ok||!d.days||d.days.length<2) throw new Error(d.error||'no data');

      for(let di=0;di<d.days.length-1;di++){
        const sigDay=d.days[di];
        const outDay=d.days[di+1];
        if(sigDay.candles.length<30||outDay.candles.length<20) continue;

        const sigData={
          sym, name:stock[1],
          base:sigDay.candles[sigDay.candles.length-1].c,
          sector:stock[3], capSize:stock[4],
          candles:sigDay.candles, news:[], _btMode:true
        };
        const signal=analyze(sigData);

        // ★ KEY FILTER: only test signals we'd actually trade
        if(signal.confidence < BT_MIN_CONF || !signal.rrPass) continue;

        // Walk outcome day bar-by-bar to find what was hit first
        let outcome='open', exitBar=outDay.candles.length-1;
        for(let bi=0;bi<outDay.candles.length;bi++){
          const bar=outDay.candles[bi];
          if(signal.side==='long'){
            if(bar.l<=signal.plan.stop){outcome='loss';   exitBar=bi;break;}
            if(bar.h>=signal.plan.t2) {outcome='t2_win'; exitBar=bi;break;}
            if(bar.h>=signal.plan.t1) {outcome='t1_win'; exitBar=bi;break;}
          }else{
            if(bar.h>=signal.plan.stop){outcome='loss';   exitBar=bi;break;}
            if(bar.l<=signal.plan.t2)  {outcome='t2_win'; exitBar=bi;break;}
            if(bar.l<=signal.plan.t1)  {outcome='t1_win'; exitBar=bi;break;}
          }
        }

        const isWin=outcome==='t1_win'||outcome==='t2_win';
        const exitPrice=outDay.candles[exitBar].c;
        const actualMove=((exitPrice-signal.ltp)/signal.ltp)*100*(signal.side==='short'?-1:1);

        // Per-indicator win-rate tracking
        signal.votes.forEach(v=>{
          const nm=normIndName(v.name);
          if(!nm||!indStats[nm]) return;
          const agreesWithSide=(v.dir>0)===(signal.side==='long');
          if(agreesWithSide&&Math.abs(v.dir)>=0.4){
            indStats[nm].total++;
            if(isWin) indStats[nm].wins++;
          }
        });

        allTrades.push({
          sym, date:sigDay.date, nextDate:outDay.date,
          side:signal.side, conf:signal.confidence,
          capSize:signal.capSize, sector:signal.sector,
          entry:signal.plan.entry, stop:signal.plan.stop,
          t1:signal.plan.t1, t2:signal.plan.t2,
          rr:signal.plan.rr,
          outcome, actualMove:+actualMove.toFixed(2), exitBar
        });
      }
    }catch(e){ /* stock failed — skip silently */ }

    // Progress update
    const pct=Math.round((si+1)/total*100);
    const pb=document.getElementById('btProgress');
    const pt=document.getElementById('btProgressTxt');
    const st=document.getElementById('btSignalTxt');
    if(pb) pb.style.width=pct+'%';
    if(pt) pt.textContent=\`\${si+1} / \${total} stocks processed (\${pct}%)\`;
    if(st) st.textContent=\`\${allTrades.length} actionable signals found (conf≥\${BT_MIN_CONF}% & R:R≥1.5)\`;

    // Batch pause every BT_BATCH stocks to respect rate limits
    if((si+1)%BT_BATCH===0){
      await new Promise(res=>setTimeout(res,BT_DELAY));
    }
  }

  const newWeights=autoTuneWeights(indStats);
  btn.disabled=false; btn.textContent='📊 BACKTEST';
  renderBtResults(allTrades, indStats, newWeights);
}

function normIndName(name){
  if(name.includes('RSI'))return 'rsi';
  if(name.includes('MACD'))return 'macd';
  if(name.includes('EMA'))return 'ema';
  if(name.includes('VWAP'))return 'vwap';
  if(name.includes('Volume'))return 'volume';
  if(name.includes('ADX'))return 'adx';
  if(name.includes('Bollinger'))return 'boll';
  if(name.includes('Stoch'))return 'stoch';
  return null;
}

function autoTuneWeights(indStats){
  // Adjust weights proportionally to win-rate above/below 50% baseline
  // Win rate 70% → weight × 1.25  |  Win rate 40% → weight × 0.80
  const newW={...BASE_WEIGHTS};
  Object.entries(indStats).forEach(([k,s])=>{
    if(s.total<3) return;   // not enough data — don't touch
    const wr=s.wins/s.total;   // 0..1
    const factor=0.5+wr;       // maps 0%→0.5, 50%→1.0, 100%→1.5
    newW[k]=Math.round(BASE_WEIGHTS[k]*factor*10)/10;
  });
  // Normalize so total weight = 100
  const total=Object.values(newW).reduce((a,b)=>a+b,0);
  const scale=100/total;
  Object.keys(newW).forEach(k=>newW[k]=Math.round(newW[k]*scale*10)/10);
  // Save tuned weights
  try{ localStorage.setItem('ie_weights',JSON.stringify(newW)); }catch(e){}
  WEIGHTS=newW;
  return newW;
}

function renderBtResults(trades, indStats, newWeights){
  if(!trades.length){
    openBtModal(\`<div class="m-hd"><div><div class="m-sym">Backtest Results</div>
      <div class="m-name">No actionable signals found</div></div>
      <div class="x" onclick="closeBt()">ESC ✕</div></div>
      <div class="m-body">
      <ul class="reason-list">
        <li class="neg"><span class="mk">✕</span><span>No signals passed the
        conf ≥ \${BT_MIN_CONF}% &amp; R:R ≥ 1.5 filter across the last \${BT_DAYS} days.
        This usually means the Worker failed to return history, or the market was
        closed/holiday for most of the test window. Check that your Worker is
        deployed and try again during or after market hours.</span></li>
      </ul></div>\`);
    return;
  }

  // ---- stats ----
  const wins    = trades.filter(t=>t.outcome==='t2_win'||t.outcome==='t1_win');
  const t2wins  = trades.filter(t=>t.outcome==='t2_win');
  const t1wins  = trades.filter(t=>t.outcome==='t1_win');
  const losses  = trades.filter(t=>t.outcome==='loss');
  const open    = trades.filter(t=>t.outcome==='open');
  const winRate = Math.round(wins.length/trades.length*100);
  const avgConf = Math.round(trades.reduce((s,t)=>s+t.conf,0)/trades.length);

  // Confidence tier breakdown
  const tiers=[
    {label:'50–59%', min:50, max:60},
    {label:'60–69%', min:60, max:70},
    {label:'70–79%', min:70, max:80},
    {label:'≥ 80%',  min:80, max:101},
  ];
  const tierRows=tiers.map(tier=>{
    const tt=trades.filter(t=>t.conf>=tier.min&&t.conf<tier.max);
    if(!tt.length) return '';
    const tw=tt.filter(t=>t.outcome==='t2_win'||t.outcome==='t1_win');
    const twr=Math.round(tw.length/tt.length*100);
    return \`<tr>
      <td style="font-weight:700">\${tier.label}</td>
      <td>\${tt.length} signals</td>
      <td style="color:\${twr>=55?'var(--green)':twr<45?'var(--red)':'var(--amber)'};font-weight:700">\${twr}% win</td>
      <td>\${tw.length} wins / \${tt.filter(t=>t.outcome==='loss').length} losses</td>
    </tr>\`;
  }).join('');

  // Cap size breakdown
  const caps=['large','mid','small'];
  const capRows=caps.map(cap=>{
    const ct=trades.filter(t=>t.capSize===cap);
    if(!ct.length) return '';
    const cw=ct.filter(t=>t.outcome==='t2_win'||t.outcome==='t1_win');
    const cwr=Math.round(cw.length/ct.length*100);
    const color=cap==='large'?'#6aa3ff':cap==='mid'?'#b87aff':'#ffb020';
    return \`<tr>
      <td style="color:\${color};font-weight:700">\${cap.toUpperCase()} CAP</td>
      <td>\${ct.length} signals</td>
      <td style="color:\${cwr>=55?'var(--green)':cwr<45?'var(--red)':'var(--amber)'};font-weight:700">\${cwr}%</td>
      <td>\${cw.length} wins / \${ct.filter(t=>t.outcome==='loss').length} losses</td>
    </tr>\`;
  }).join('');

  // Top sectors by signal count
  const sectorMap={};
  trades.forEach(t=>{const s=t.sector||'Unknown';
    if(!sectorMap[s])sectorMap[s]={total:0,wins:0};
    sectorMap[s].total++;
    if(t.outcome==='t2_win'||t.outcome==='t1_win')sectorMap[s].wins++;});
  const sectorRows=Object.entries(sectorMap)
    .sort((a,b)=>b[1].total-a[1].total).slice(0,6)
    .map(([s,v])=>{const wr=Math.round(v.wins/v.total*100);
      return \`<tr><td style="font-weight:600">\${s}</td><td>\${v.total}</td>
      <td style="color:\${wr>=55?'var(--green)':wr<45?'var(--red)':'var(--amber)'};font-weight:700">\${wr}%</td></tr>\`;
    }).join('');

  // Indicator table
  const indRows=Object.entries(indStats)
    .filter(([,s])=>s.total>0)
    .sort((a,b)=>(b[1].wins/b[1].total)-(a[1].wins/a[1].total))
    .map(([k,s])=>{
      const wr=s.total?Math.round(s.wins/s.total*100):0;
      const oldW=BASE_WEIGHTS[k];
      const newW=Math.round(newWeights[k]*10)/10;
      const delta=newW-oldW;
      const deltaStr=delta>=0?\`+\${delta.toFixed(1)}\`:\`\${delta.toFixed(1)}\`;
      const barW=Math.round((newW/Math.max(...Object.values(newWeights)))*100);
      return \`<tr>
        <td style="font-family:var(--sans);font-weight:600">\${k.toUpperCase()}</td>
        <td>\${s.wins}/\${s.total}</td>
        <td style="color:\${wr>=55?'var(--green)':wr<45?'var(--red)':'var(--amber)'};font-weight:700">\${wr}%</td>
        <td>\${oldW}</td>
        <td style="color:\${delta>=0?'var(--green)':'var(--red)'};font-weight:600">
          \${newW} <small>\${deltaStr}</small></td>
        <td style="width:80px"><div class="wt-bar"><div style="width:\${barW}%"></div></div></td>
      </tr>\`;
    }).join('');

  // Signal log (most recent 40, sorted newest first)
  const recentTrades=[...trades].reverse().slice(0,40);
  const tradeRows=recentTrades.map(t=>{
    const ocls=t.outcome==='t2_win'?'bt-win':t.outcome==='t1_win'?'bt-t1':
      t.outcome==='loss'?'bt-loss':'bt-open';
    const olabel=t.outcome==='t2_win'?'✓ T2 WIN':t.outcome==='t1_win'?
      '~ T1 WIN':t.outcome==='loss'?'✗ LOSS':'— OPEN';
    const capColor=t.capSize==='large'?'#6aa3ff':t.capSize==='mid'?'#b87aff':'#ffb020';
    return \`<tr>
      <td>\${t.date}</td>
      <td style="font-weight:700">\${t.sym}
        <span style="color:\${capColor};font-size:9px"> \${(t.capSize||'').toUpperCase()}</span></td>
      <td style="color:var(--muted);font-size:10px">\${t.sector||''}</td>
      <td>\${t.side==='long'?'▲ LONG':'▼ SHORT'}</td>
      <td style="color:\${t.conf>=70?'var(--green)':t.conf>=60?'var(--amber)':'var(--ink)'}">\${t.conf}%</td>
      <td class="\${ocls}">\${olabel}</td>
      <td style="color:\${t.actualMove>=0?'var(--green)':'var(--red)'}">
        \${t.actualMove>=0?'+':''}\${t.actualMove}%</td>
    </tr>\`;
  }).join('');

  const stocksWithData=new Set(trades.map(t=>t.sym)).size;

  openBtModal(\`
    <div class="m-hd">
      <div>
        <div class="m-sym">📊 Backtest Results</div>
        <div class="m-name">
          \${stocksWithData} stocks returned data · \${BT_DAYS} days ·
          \${trades.length} actionable signals (conf ≥ \${BT_MIN_CONF}% &amp; R:R ≥ 1.5)
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn" onclick="applyTunedWeights()"
          style="font-size:11px;padding:7px 12px">✓ APPLY TUNED WEIGHTS</button>
        <button class="btn" onclick="resetWeights()"
          style="font-size:11px;padding:7px 12px">↺ RESET DEFAULT</button>
        <div class="x" onclick="closeBt()">ESC ✕</div>
      </div>
    </div>
    <div class="m-body">

      <div class="sec-t">▸ How Stocks Were Selected</div>
      <ul class="reason-list" style="margin-bottom:18px">
        <li class="info"><span class="mk">ⓘ</span><span>
          <b>All \${UNIVERSE.length} stocks</b> in your universe were scanned.
          \${stocksWithData} returned usable historical data from Yahoo Finance.
          The remaining \${UNIVERSE.length-stocksWithData} either had too few bars
          (thin trading days) or Yahoo returned no intraday history for them —
          this is normal for less-liquid small-caps.</span></li>
        <li class="info"><span class="mk">ⓘ</span><span>
          <b>Only actionable signals are counted.</b> For each stock × each day,
          the engine generated a signal — but it only enters the backtest if
          confidence ≥ \${BT_MIN_CONF}% AND R:R ≥ 1.5. Low-confidence signals
          (which you'd never trade) are excluded. Total signals generated across
          all stocks and days was higher; \${trades.length} passed the filter.</span></li>
        <li class="info"><span class="mk">ⓘ</span><span>
          <b>\${BT_DAYS} trading days</b> of history tested — Yahoo Finance only
          keeps 5-minute intraday data for ~60 days. Each day-pair: signal
          generated on Day D using that day's 5-min candles; outcome checked
          on Day D+1 bar-by-bar (first to hit T1, T2, or Stop Loss wins/loses).</span></li>
      </ul>

      <div class="bt-grid">
        <div class="bt-stat"><div class="bk">Signals Tested</div>
          <div class="bv">\${trades.length}</div></div>
        <div class="bt-stat"><div class="bk">Overall Win Rate</div>
          <div class="bv" style="color:\${winRate>=55?'var(--green)':winRate<45?'var(--red)':'var(--amber)'}">
            \${winRate}%</div></div>
        <div class="bt-stat"><div class="bk">T2 Full Wins</div>
          <div class="bv" style="color:var(--green)">\${t2wins.length}</div></div>
        <div class="bt-stat"><div class="bk">T1 Partial Wins</div>
          <div class="bv" style="color:var(--amber)">\${t1wins.length}</div></div>
        <div class="bt-stat"><div class="bk">Losses / Open</div>
          <div class="bv"><span style="color:var(--red)">\${losses.length}</span>
            <small style="color:var(--faint)"> / \${open.length}</small></div></div>
      </div>

      <div class="sec-t">▸ Win Rate by Confidence Tier</div>
      <div style="font-size:11px;color:var(--faint);font-family:var(--mono);margin-bottom:8px">
        Does higher confidence actually mean better outcomes?</div>
      <table class="bt-table">
        <thead><tr><th>Confidence</th><th>Signals</th><th>Win Rate</th><th>Breakdown</th></tr></thead>
        <tbody>\${tierRows||'<tr><td colspan="4" style="color:var(--faint)">Not enough data per tier</td></tr>'}</tbody>
      </table>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:4px">
        <div>
          <div class="sec-t">▸ By Cap Size</div>
          <table class="bt-table">
            <thead><tr><th>Cap</th><th>Signals</th><th>Win Rate</th><th>W/L</th></tr></thead>
            <tbody>\${capRows||'<tr><td colspan="4" style="color:var(--faint)">No data</td></tr>'}</tbody>
          </table>
        </div>
        <div>
          <div class="sec-t">▸ By Sector (top 6)</div>
          <table class="bt-table">
            <thead><tr><th>Sector</th><th>Signals</th><th>Win Rate</th></tr></thead>
            <tbody>\${sectorRows||'<tr><td colspan="3" style="color:var(--faint)">No data</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="sec-t">▸ Indicator Performance & Auto-Tuned Weights</div>
      <div style="font-size:11px;color:var(--faint);font-family:var(--mono);margin-bottom:8px">
        How often each indicator backed a winning trade when it agreed with the signal direction.</div>
      <table class="bt-table">
        <thead><tr><th>Indicator</th><th>Wins/Total</th><th>Win Rate</th>
          <th>Old Wt</th><th>New Wt</th><th>New Weight Bar</th></tr></thead>
        <tbody>\${indRows}</tbody>
      </table>

      <div class="sec-t">▸ Signal Log
        <span style="color:var(--faint);font-size:9px;font-weight:400">
          · most recent \${Math.min(40,trades.length)} of \${trades.length} signals</span>
      </div>
      <div style="overflow-x:auto">
      <table class="bt-table">
        <thead><tr><th>Date</th><th>Stock</th><th>Sector</th><th>Dir</th>
          <th>Conf</th><th>Outcome</th><th>Next Day Move</th></tr></thead>
        <tbody>\${tradeRows}</tbody>
      </table></div>

      <div class="disclaimer" style="margin:18px 0 4px">
        <b>⚠ Backtest limitations:</b> Direction is tested on next-day 5-min bars —
        this does not model slippage, impact cost, or brokerage. A "win" means the
        target was touched intraday, not that you'd have exited at exactly that price.
        Results over 30 days on ~200 stocks give a meaningful signal but not a guarantee.
        The auto-tuned weights improve fit to recent data — apply them and re-run the
        backtest after a week to see if the improvements hold.
      </div>
    </div>\`);
}

function openBtModal(html){
  document.getElementById('btModal').innerHTML=html;
  document.getElementById('btOverlay').classList.add('show');
  document.body.style.overflow='hidden';
}
function closeBt(){
  document.getElementById('btOverlay').classList.remove('show');
  document.body.style.overflow='';
}
function applyTunedWeights(){
  try{const saved=localStorage.getItem('ie_weights');
    if(saved){WEIGHTS=JSON.parse(saved);}}catch(e){}
  closeBt();
  document.getElementById('scanNote').textContent+=' · Tuned weights applied ✓';
}
function resetWeights(){
  WEIGHTS={...BASE_WEIGHTS};
  try{localStorage.removeItem('ie_weights');}catch(e){}
  closeBt();
  document.getElementById('scanNote').textContent+=' · Weights reset to default';
}
document.getElementById('btOverlay').onclick=e=>{if(e.target.id==='btOverlay')closeBt();};

/* ---------- 10. BOOT ----------------------------------------------------- */
runScan();
</script>
</body>
</html>
`;

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url    = new URL(request.url);
    const symbol = (url.searchParams.get('symbol') || '').toUpperCase().trim();
    const mode   = url.searchParams.get('mode') || 'live';
    const days   = Math.min(30, parseInt(url.searchParams.get('days') || '15', 10));

    // ---- Serve the dashboard at root (no symbol param) --------------------
    if (!symbol) {
      return new Response(DASHBOARD_HTML, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          // Cache for 5 min at edge — fast loads on mobile
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    // ---- Data API endpoints -----------------------------------------------
    const isNifty = symbol === 'NIFTY50' || symbol === '^NSEI';
    const ySym    = isNifty ? '^NSEI' : (symbol.endsWith('.NS') ? symbol : symbol + '.NS');

    if (mode === 'index')   return handleIndex(ySym);
    if (mode === 'history') return handleHistory(ySym, symbol, days);
    return handleLive(ySym, symbol);
  },
};

/* ---- MODE 1: live intraday bars ----------------------------------------- */
async function handleLive(ySym, sym) {
  try {
    const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ySym}` +
      `?range=1d&interval=5m&includePrePost=false`;
    const data = await yFetch(yUrl, 60);
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return json({ ok: false, error: 'No data', sym });
    return json({
      ok: true, sym,
      meta: {
        ltp:       result.meta?.regularMarketPrice ?? null,
        prevClose: result.meta?.chartPreviousClose ?? null,
        currency:  result.meta?.currency ?? 'INR',
      },
      candles: parseCandles(result),
    });
  } catch (e) { return json({ ok: false, error: e.message, sym }); }
}

/* ---- MODE 2: history for backtest --------------------------------------- */
async function handleHistory(ySym, sym, days) {
  try {
    const now     = Math.floor(Date.now() / 1000);
    const period1 = now - (days + 10) * 24 * 3600;
    const yUrl    = `https://query1.finance.yahoo.com/v8/finance/chart/${ySym}` +
      `?period1=${period1}&period2=${now}&interval=5m&includePrePost=false`;
    const data = await yFetch(yUrl, 300);
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return json({ ok: false, error: 'No history', sym });

    const byDay = {};
    const q = result.indicators.quote[0];
    for (let i = 0; i < result.timestamp.length; i++) {
      if (q.open[i] == null || q.close[i] == null) continue;
      const d = toISTDate(result.timestamp[i]);
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push({ o: q.open[i], h: q.high[i], l: q.low[i],
        c: q.close[i], v: q.volume[i] || 0 });
    }
    const sortedDays = Object.keys(byDay).sort().slice(-days).map(date => ({
      date, candles: byDay[date]
    }));
    return json({ ok: true, sym, days: sortedDays });
  } catch (e) { return json({ ok: false, error: e.message, sym }); }
}

/* ---- MODE 3: Nifty index trend ----------------------------------------- */
async function handleIndex(ySym) {
  try {
    const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ySym}` +
      `?range=5d&interval=1d&includePrePost=false`;
    const data = await yFetch(yUrl, 300);
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return json({ ok: false, error: 'No index data' });
    const closes = result.indicators.quote[0].close.filter(v => v != null);
    if (closes.length < 2) return json({ ok: false, error: 'Insufficient data' });
    const close  = closes[closes.length - 1];
    const prev   = closes[closes.length - 2];
    const change = ((close - prev) / prev) * 100;
    const trend  = change > 0.3 ? 'up' : change < -0.3 ? 'down' : 'flat';
    return json({ ok: true, close, prev, change: +change.toFixed(2), trend });
  } catch (e) { return json({ ok: false, error: e.message }); }
}

/* ---- helpers ------------------------------------------------------------ */
async function yFetch(url, cacheTtl = 60) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    cf: { cacheTtl, cacheEverything: true },
  });
  if (!r.ok) throw new Error('Yahoo HTTP ' + r.status);
  return r.json();
}

function parseCandles(result) {
  const q = result.indicators.quote[0];
  const out = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    if (q.open[i] == null || q.close[i] == null) continue;
    out.push({ o: q.open[i], h: q.high[i], l: q.low[i],
      c: q.close[i], v: q.volume[i] || 0 });
  }
  return out;
}

function toISTDate(unixSec) {
  const d = new Date((unixSec + 5.5 * 3600) * 1000);
  return d.toISOString().slice(0, 10);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
