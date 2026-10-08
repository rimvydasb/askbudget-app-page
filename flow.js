/**
 * Draws the "Statements in. Answers out." diagram in the style of React Flow:
 * nodes are plain HTML laid out by CSS grid, and this script measures them and
 * draws bezier edges, handles, labels and moving particles in an SVG overlay.
 *
 * Wide screens flow left to right, one edge per node. Narrow screens stack the
 * groups top to bottom and bundle the edges per group, so no edge crosses a node.
 */
(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var TONES = {blue: '#60a5fa', violet: '#a78bfa', green: '#34d399'};
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var stackedQuery = window.matchMedia('(max-width: 1040px)');

    var WIDE_EDGES = [
        {from: 'n-broker', to: 'n-app', label: 'file upload', tone: 'blue'},
        {from: 'n-bank', to: 'n-app', label: 'file upload', tone: 'blue'},
        {from: 'n-t212', to: 'n-app', label: 'API keys', tone: 'blue'},
        {from: 'n-crypto', to: 'n-app', label: 'via CCXT', tone: 'blue'},
        {from: 'n-ofin', to: 'n-app', label: 'Open Finance', tone: 'blue'},
        {from: 'n-app', to: 'n-dash', tone: 'violet'},
        {from: 'n-app', to: 'n-tx', tone: 'violet'},
        {from: 'n-app', to: 'n-hold', tone: 'violet'},
        {from: 'n-app', to: 'n-mcp', tone: 'green'},
        {from: 'n-mcp', to: 'n-cd', tone: 'green'},
        {from: 'n-mcp', to: 'n-cc', tone: 'green'},
        {from: 'n-mcp', to: 'n-llm', tone: 'green'},
    ];

    var STACKED_EDGES = [
        {from: 'g-in', to: 'n-app', label: 'upload · API · CCXT · Open Finance', tone: 'blue'},
        {from: 'n-app', to: 'g-out', tone: 'violet'},
        {from: 'g-out', to: 'g-agent', label: 'MCP', tone: 'green'},
    ];

    function init() {
        document.documentElement.classList.remove('no-js');
        initFlow();
        initReveal();
        initCopy();
    }

    /* ----------------------------------------------------------- diagram */

    function initFlow() {
        var canvas = document.getElementById('flow');
        var svg = document.getElementById('flow-edges');
        var labels = document.getElementById('flow-labels');
        if (!canvas || !svg || !labels) return;

        var mode = null;
        var edges = [];

        function build() {
            mode = stackedQuery.matches ? 'stacked' : 'wide';
            // Edges to or from a box the explanation panel has replaced are not drawn.
            var spec = (mode === 'stacked' ? STACKED_EDGES : WIDE_EDGES).filter(function (e) {
                return isShown(e.from) && isShown(e.to);
            });

            svg.textContent = '';
            labels.textContent = '';

            var defs = el('defs');
            svg.appendChild(defs);
            var baseLayer = el('g');
            var flowLayer = el('g');
            var dotLayer = el('g');
            var handleLayer = el('g');
            svg.append(baseLayer, flowLayer, dotLayer, handleLayer);

            edges = spec.map(function (e, i) {
                var color = TONES[e.tone];
                var id = 'edge-' + i;
                var gradId = 'grad-' + i;

                var grad = el('linearGradient', {id: gradId, gradientUnits: 'userSpaceOnUse'});
                grad.append(
                    el('stop', {offset: '0', 'stop-color': color, 'stop-opacity': '0.35'}),
                    el('stop', {offset: '1', 'stop-color': color, 'stop-opacity': '1'})
                );
                defs.appendChild(grad);

                var base = el('path', {id: id, class: 'edge-base', stroke: color});
                var flow = el('path', {class: 'edge-flow', stroke: 'url(#' + gradId + ')'});
                baseLayer.appendChild(base);
                flowLayer.appendChild(flow);

                if (!reduceMotion) {
                    // Two particles per edge, offset so the stream looks continuous.
                    var dur = (mode === 'stacked' ? 2.2 : 2.6) + (i % 4) * 0.35;
                    for (var k = 0; k < 2; k++) {
                        var dot = el('circle', {r: '2.6', fill: color, class: 'edge-dot', color: color});
                        var motion = el('animateMotion', {
                            dur: dur + 's',
                            repeatCount: 'indefinite',
                            begin: -((k * dur) / 2 + (i * 0.37) % dur) + 's',
                            keyPoints: '0;1',
                            keyTimes: '0;1',
                            calcMode: 'spline',
                            keySplines: '0.45 0 0.55 1',
                        });
                        var mpath = el('mpath');
                        mpath.setAttribute('href', '#' + id);
                        mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + id);
                        motion.appendChild(mpath);
                        dot.appendChild(motion);
                        dotLayer.appendChild(dot);
                    }
                }

                var label = null;
                if (e.label) {
                    label = document.createElement('span');
                    label.className = 'edge-label';
                    label.textContent = e.label;
                    labels.appendChild(label);
                }

                var hs = el('circle', {r: '3.5', class: 'handle', stroke: color});
                var ht = el('circle', {r: '3.5', class: 'handle', stroke: color});
                handleLayer.append(hs, ht);

                return {spec: e, base: base, flow: flow, grad: grad, label: label, hs: hs, ht: ht};
            });

            draw();
        }

        function draw() {
            var box = canvas.getBoundingClientRect();
            svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);

            edges.forEach(function (edge) {
                var a = rectOf(edge.spec.from, box);
                var b = rectOf(edge.spec.to, box);
                if (!a || !b) return;

                var x1, y1, x2, y2, d;
                if (mode === 'wide') {
                    x1 = a.right; y1 = a.cy;
                    x2 = b.left; y2 = b.cy;
                    var dx = Math.max(30, (x2 - x1) * 0.5);
                    d = 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2;
                } else {
                    x1 = a.cx; y1 = a.bottom;
                    x2 = b.cx; y2 = b.top;
                    var dy = Math.max(20, (y2 - y1) * 0.5);
                    d = 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + dy) + ' ' + x2 + ',' + (y2 - dy) + ' ' + x2 + ',' + y2;
                }

                edge.base.setAttribute('d', d);
                edge.flow.setAttribute('d', d);
                setAttrs(edge.grad, {x1: x1, y1: y1, x2: x2, y2: y2});
                setAttrs(edge.hs, {cx: x1, cy: y1});
                setAttrs(edge.ht, {cx: x2, cy: y2});

                if (edge.label) {
                    // Labels sit nearer the source in the wide layout, where five edges converge on one node.
                    var p = edge.base.getPointAtLength(edge.base.getTotalLength() * (mode === 'wide' ? 0.36 : 0.5));
                    edge.label.style.left = p.x + 'px';
                    edge.label.style.top = p.y + 'px';
                }
            });
        }

        var frame = 0;
        function schedule() {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(function () {
                var want = stackedQuery.matches ? 'stacked' : 'wide';
                if (want !== mode) build(); else draw();
            });
        }

        build();
        initDetail(canvas, build);
        if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(canvas);
        window.addEventListener('resize', schedule);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    }


    /* ------------------------------------------- incoming-data explanations */

    var BANK_ROWS = [
        ['Lithuania', ['Swedbank', 'SEB', 'Luminor (PDF)', 'Paysera']],
        ['Neobanks', ['Revolut (two CSV layouts)', 'Wise', 'N26', 'bunq', 'Monzo', 'Starling']],
        ['Germany', ['ING', 'DKB', 'Sparkasse', 'Commerzbank', 'Deutsche Bank / Postbank']],
        ['Netherlands', ['ING', 'Rabobank']],
        ['Belgium', ['BNP Paribas Fortis', 'KBC', 'Belfius', 'ING']],
        ['Nordics', ['Nordea (SE, FI, DK)', 'Danske Bank (DK)']],
        ['United Kingdom', ['Lloyds / Halifax / Bank of Scotland', 'Barclays']],
        ['France', ['Boursorama', 'Société Générale']],
        ['Poland', ['mBank', 'PKO Bank Polski']],
    ];

    var DETAILS = {
        'n-broker': {
            title: 'Brokerage statements',
            tag: 'file upload',
            lead: 'Drop in a broker’s statement and AskBudget reads what the account is worth and what it holds. ' +
                'Trades, dividends and interest stay inside the brokerage account, so they never inflate spending or income.',
            chips: ['Supported formats', ['Interactive Brokers (IBKR) Activity Statement, CSV']],
            lists: ['What is read', [
                'Net Asset Value, used as the account balance and checked like a bank’s closing balance',
                'Open Positions, stored as holdings',
                'Cash Report, with each currency’s ending cash stored as a holding too',
            ]],
            foot: 'Revolut’s consolidated statement also carries fund and crypto sections, and those land in Holdings as well. ' +
                'Trading 212 has a direct connection, see its own box.',
        },
        'n-bank': {
            title: 'Bank statements',
            tag: 'file upload',
            lead: '30 statement formats from European banks and neobanks. Export the file from your online banking, ' +
                'drop it in, and the format is recognised from its content.',
            rows: BANK_ROWS,
            lists: ['What happens to a file', [
                'CSV exports in the languages and encodings banks really use (UTF-8, Windows-1250/1252/1257); Luminor as PDF',
                'Every new statement is checked against the balances the bank prints, and gaps are flagged',
                'Pending and refused entries are skipped',
                'Importing the same file twice, or overlapping files, adds nothing: rows are matched by fingerprint',
                'Several accounts and currencies per person; amounts converted to your base currency',
                'Transfers between your own accounts are paired and left out of income and spending; refunds are folded back into the purchase',
                'Each row gets a merchant, a category and a flow: income, spending, savings, internal or perimeter',
            ]],
            foot: 'Add one under Accounts → New account → Imported account, or copy it into the inbox folder and run update. ' +
                'Another bank? An adapter is a small file with a declared header.',
        },
        'n-t212': {
            title: 'Trading 212',
            tag: 'API keys',
            lead: 'Connected directly with an API key and secret, no file export. One key is one account: Invest or Stocks ISA.',
            lists: ['What is synced', [
                'Cash and every open position, valued in the account’s own currency, into Holdings',
                'Filled orders, dividends, deposits, withdrawals, interest and fees, into Transactions',
                'Deposits and withdrawals are matched as transfer legs, and buys count as investments, not spending',
                'A second sync reads the same movements again and inserts nothing new',
            ]],
            chips: ['Good to know', ['Read-only', 'Keys stored encrypted', 'Rate limits waited out', 'Live account']],
            foot: 'The key never leaves your server: it is sealed with your own master key and sent only to Trading 212.',
        },
        'n-crypto': {
            title: 'Binance, Coinbase, …',
            tag: 'via CCXT',
            lead: 'Crypto exchanges connect through CCXT, the open-source library behind most exchange integrations. ' +
                'Add a read-only API key and the balances show up in Holdings.',
            chips: ['Exchanges', ['Binance', 'Coinbase', 'Kraken', 'Bybit', 'OKX', 'KuCoin', 'every other exchange CCXT lists']],
            lists: ['What is synced', [
                'Every non-zero balance, summed per coin across spot, funding and other account types the key may see',
                'Binance Simple Earn savings, which the standard balance call leaves out',
                'Each coin priced in your base currency from the exchange’s own daily candle',
            ]],
            foot: 'Balances only, not trade history. Create the key with read permission alone.',
        },
        'n-ofin': {
            title: 'Other banks',
            tag: 'planned',
            planned: true,
            lead: 'Connecting banks directly through Open Finance is on the roadmap and not built yet. ' +
                'Until then, banks like Revolut and Swedbank work through their statement exports.',
            lists: ['Today', [
                'Revolut, Swedbank, SEB, Luminor, Paysera and many more: export a statement and upload it',
                'Trading 212 and crypto exchanges connect by API key',
            ]],
            foot: 'This arrow shows the direction, not a feature you can switch on today.',
        },
    };

    function buildDetail(d) {
        var frag = document.createDocumentFragment();

        var head = h('div', 'detail-head');
        head.append(h('h3', null, d.title), h('span', 'detail-tag' + (d.planned ? ' is-planned' : ''), d.tag));
        var close = h('button', 'detail-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close');
        close.dataset.close = '1';
        head.appendChild(close);
        frag.append(head, h('p', 'detail-lead', d.lead));

        if (d.chips) frag.appendChild(chipSection(d.chips[0], d.chips[1]));

        if (d.rows) {
            var sec = h('div', 'detail-sec');
            sec.appendChild(h('h4', null, 'Supported banks'));
            var dl = h('dl', 'detail-rows');
            d.rows.forEach(function (row) {
                dl.appendChild(h('dt', null, row[0]));
                var dd = h('dd', 'detail-chips');
                row[1].forEach(function (name) { dd.appendChild(h('span', null, name)); });
                dl.appendChild(dd);
            });
            sec.appendChild(dl);
            frag.appendChild(sec);
        }

        if (d.lists) {
            var ls = h('div', 'detail-sec');
            ls.appendChild(h('h4', null, d.lists[0]));
            var ul = h('ul', 'detail-list' + (d.lists[1].length > 5 ? ' is-wide' : ''));
            d.lists[1].forEach(function (t) { ul.appendChild(h('li', null, t)); });
            ls.appendChild(ul);
            frag.appendChild(ls);
        }

        if (d.foot) frag.appendChild(h('p', 'detail-lead', d.foot));
        return frag;
    }

    function chipSection(title, names) {
        var sec = h('div', 'detail-sec');
        sec.appendChild(h('h4', null, title));
        var wrap = h('div', 'detail-chips');
        names.forEach(function (n) { wrap.appendChild(h('span', null, n)); });
        sec.appendChild(wrap);
        return sec;
    }

    function h(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    /** Hover previews an incoming node, click pins it; the right half of the diagram makes room. */
    function initDetail(canvas, onChange) {
        var panel = document.getElementById('flow-detail');
        var group = document.getElementById('g-in');
        if (!panel || !group) return;

        var nodes = Array.prototype.slice.call(group.querySelectorAll('.node-info'));
        var shown = null;
        var pinned = null;
        var timer = 0;

        function show(id) {
            clearTimeout(timer);
            if (shown === id) return;
            shown = id;
            panel.textContent = '';
            panel.appendChild(buildDetail(DETAILS[id]));
            panel.scrollTop = 0;
            // At least as tall as the incoming group; longer content grows the box instead of scrolling.
            panel.style.minHeight = stackedQuery.matches ? '' : group.offsetHeight + 'px';
            // Pin the group's width before the other columns go away, so it never resizes.
            if (!canvas.classList.contains('has-detail')) canvas.style.setProperty('--g-in-w', group.offsetWidth + 'px');
            canvas.classList.add('has-detail');
            sync();
        }

        function hide() {
            clearTimeout(timer);
            if (!shown) return;
            shown = pinned = null;
            panel.style.minHeight = '';
            canvas.classList.remove('has-detail');
            canvas.style.removeProperty('--g-in-w');
            sync();
        }

        function sync() {
            nodes.forEach(function (n) {
                n.classList.toggle('is-active', n.id === shown);
                n.setAttribute('aria-pressed', String(n.id === pinned));
            });
            onChange();
        }

        function leaveSoon() {
            clearTimeout(timer);
            if (!pinned) timer = setTimeout(hide, 450);
        }

        nodes.forEach(function (n) {
            n.addEventListener('mouseenter', function () { if (!pinned) show(n.id); });
            n.addEventListener('focus', function () { if (!pinned) show(n.id); });
            n.addEventListener('click', function () {
                if (pinned === n.id) { hide(); return; }
                pinned = n.id;
                show(n.id);
                sync();
            });
            n.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); n.click(); }
            });
        });

        [group, panel].forEach(function (zone) {
            zone.addEventListener('mouseenter', function () { clearTimeout(timer); });
            zone.addEventListener('mouseleave', leaveSoon);
        });
        panel.addEventListener('click', function (e) {
            if (e.target.closest('[data-close]')) hide();
        });
        // The pinned width goes stale on resize, so the panel closes instead.
        window.addEventListener('resize', hide);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') hide();
        });
    }

    function isShown(id) {
        var node = document.getElementById(id);
        return !!node && node.offsetParent !== null;
    }

    function rectOf(id, box) {
        var node = document.getElementById(id);
        if (!node) return null;
        var r = node.getBoundingClientRect();
        var left = r.left - box.left;
        var top = r.top - box.top;
        return {
            left: left, top: top,
            right: left + r.width, bottom: top + r.height,
            cx: left + r.width / 2, cy: top + r.height / 2,
        };
    }

    function el(name, attrs) {
        var node = document.createElementNS(SVG_NS, name);
        if (attrs) setAttrs(node, attrs);
        return node;
    }

    function setAttrs(node, attrs) {
        for (var k in attrs) node.setAttribute(k, attrs[k]);
    }

    /* ------------------------------------------------------------ reveal */

    function initReveal() {
        var items = document.querySelectorAll('.reveal');
        if (!('IntersectionObserver' in window) || reduceMotion) {
            items.forEach(function (n) { n.classList.add('is-visible'); });
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                io.unobserve(entry.target);
            });
        }, {rootMargin: '0px 0px -8% 0px', threshold: 0.08});

        items.forEach(function (n) {
            // Siblings in a grid fade in one after another.
            var siblings = n.parentElement ? n.parentElement.querySelectorAll(':scope > .reveal') : [];
            var index = Array.prototype.indexOf.call(siblings, n);
            n.style.transitionDelay = Math.min(index, 6) * 70 + 'ms';
            io.observe(n);
        });
    }

    /* -------------------------------------------------------------- copy */

    function initCopy() {
        document.querySelectorAll('[data-copy]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var source = document.getElementById(btn.getAttribute('data-copy'));
                if (!source || !navigator.clipboard) return;
                navigator.clipboard.writeText(source.textContent.trim()).then(function () {
                    btn.classList.add('copied');
                    setTimeout(function () { btn.classList.remove('copied'); }, 1600);
                });
            });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
