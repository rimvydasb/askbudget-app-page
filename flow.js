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
            var spec = mode === 'stacked' ? STACKED_EDGES : WIDE_EDGES;

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
        if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(canvas);
        window.addEventListener('resize', schedule);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
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
