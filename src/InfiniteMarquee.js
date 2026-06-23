import gsap from 'gsap';

/**
 * InfiniteMarquee
 * A framework-agnostic, instance-scoped infinite loop driven by wheel + drag +
 * optional autoplay drift, with optional snap-to-item (origin or center) and momentum.
 *
 * Architecture (the invariant across every driver):
 *   - every driver (wheel, drag, autoplay) writes to  this.target  (one unbounded offset)
 *   - rAF loop eases  this.current  toward target (frame-rate independent)
 *   - render() folds current across items via wrap() (the period reset)
 *
 * Driver composition: because all drivers write the SAME target, they combine
 * with no coordination. Autoplay pauses while dragging / hovering.
 *
 * Note: autoplay (continuous drift) and snap fight each other — drift pulls
 * target off any snapped rest position. Use autoplay with snap:false for a
 * marquee feel, or snap with autoplay:false for a carousel feel.
 *
 * Extensibility seams (override or inject without touching the core):
 *   - renderer:   { measure(items, gap), apply(items, positions) }  ← swap DOM for WebGL here
 *   - settle():   decides where target rests when input stops        ← snap / free / custom
 */
export default class InfiniteMarquee {
	constructor(container, options = {}) {
		this.container = container;

		// ---- config with defaults (all per-instance, all documented here) ----
		this.opts = {
			itemSelector: '.marquee__item',
			gap: 16,
			ease: 0.08, // smooth-scroll lerp: lower = floatier, higher = snappier
			friction: 0.94, // momentum decay per frame: closer to 1 = longer coast
			dragMultiplier: 2.4, // drag sensitivity
			snap: true, // settle on item boundaries when input stops
			snapMode: 'center', // 'origin' (left edge to 0) | 'center' (item center to container center)
			snapDelay: 120, // ms of wheel quiet before snapping
			velocitySamples: 4, // moving-average window for release velocity (noise fix)
			autoplay: false, // continuous drift driver
			autoplaySpeed: 40, // px per second of drift
			pauseOnHover: true, // pause autoplay while pointer is over the container
			...options,
		};

		this.items = Array.from(container.querySelectorAll(this.opts.itemSelector));

		// ---- instance state (no module-level globals → multiple instances OK) ----
		this.target = 0;
		this.current = 0;
		this.isDragging = false;
		this._hovering = false;
		this.lastPointerX = 0;
		this._velSamples = []; // ring of recent {dx, dt} for averaging
		this._raf = 0;
		this._wheelStop = 0;
		this._resizePending = 0;
		this._last = performance.now();
		this._running = false;

		// default DOM renderer — the ONLY place that knows about DOM/gsap.
		// Swap this for a WebGL renderer later; the core never changes.
		this.renderer = options.renderer || InfiniteMarquee.domRenderer();

		// bind once so add/removeEventListener share the same references
		this._onWheel = this._onWheel.bind(this);
		this._onPointerDown = this._onPointerDown.bind(this);
		this._onPointerMove = this._onPointerMove.bind(this);
		this._onPointerUp = this._onPointerUp.bind(this);
		this._onResize = this._onResize.bind(this);
		this._frame = this._frame.bind(this);

		this.init();
	}

	// ---- lifecycle ---------------------------------------------------------
	init() {
		this.measure();
		this._bind();
		this._running = true;
		this._last = performance.now();
		this._raf = requestAnimationFrame(this._frame);
	}

	destroy() {
		this._running = false;
		cancelAnimationFrame(this._raf);
		cancelAnimationFrame(this._resizePending);
		clearTimeout(this._wheelStop);
		this.container.removeEventListener('wheel', this._onWheel, { passive: false });
		this.container.removeEventListener('pointerdown', this._onPointerDown);
		window.removeEventListener('pointermove', this._onPointerMove);
		window.removeEventListener('pointerup', this._onPointerUp);
		window.removeEventListener('resize', this._onResize);
		if (this._onEnter) {
			this.container.removeEventListener('pointerenter', this._onEnter);
			this.container.removeEventListener('pointerleave', this._onLeave);
		}
	}

	_bind() {
		this.container.addEventListener('wheel', this._onWheel, { passive: false });
		this.container.addEventListener('pointerdown', this._onPointerDown);
		window.addEventListener('pointermove', this._onPointerMove);
		window.addEventListener('pointerup', this._onPointerUp);
		window.addEventListener('resize', this._onResize);
		this.container.style.touchAction = 'pan-y';

		if (this.opts.pauseOnHover) {
			this._onEnter = () => (this._hovering = true);
			this._onLeave = () => (this._hovering = false);
			this.container.addEventListener('pointerenter', this._onEnter);
			this.container.addEventListener('pointerleave', this._onLeave);
		}
	}

	// ---- measurement (sole layout reader; init + resize only) --------------
	measure() {
		this.total = this.items.length;
		// delegate the actual width read to the renderer, so a WebGL renderer
		// can measure planes/world-units instead of DOM offsetWidth.
		this.itemWidth = this.renderer.measure(this.items, this.opts.gap);
		this.totalWidth = this.itemWidth * this.total;
		this.wrap = gsap.utils.wrap(-this.itemWidth, this.totalWidth - this.itemWidth);

		// center offset c = W/2 − itemWidth/2 so a card lands dead center;
		// origin mode uses c = 0 (left edge to offset grid). Recomputed here
		// because it depends on container width, which changes on resize.
		this.centerOffset = this.opts.snapMode === 'center' ? this.container.clientWidth / 2 - this.itemWidth / 2 : 0;

		this.current = this.wrap(this.current); // re-fold so resize never strands us
		this.target = this.wrap(this.target);
		this.render();
	}

	// ---- render: compute positions, hand to renderer (the swappable seam) --
	render() {
		const { items, itemWidth, current, wrap } = this;
		// core owns the MATH; renderer owns the APPLICATION.
		const positions = items.map((_, i) => wrap(i * itemWidth + current));
		this.renderer.apply(items, positions);
	}

	// ---- settle: where target rests when input stops (override for custom) -
	settle(projected = this.target) {
		if (!this.opts.snap) {
			this.target = projected; // free-scroll: land wherever momentum dies
			return;
		}
		// same rounding as origin snap, but on a grid phase-shifted by centerOffset.
		// c = 0 collapses to origin snap, so one line handles both modes.
		const c = this.centerOffset;
		this.target = Math.round((projected - c) / this.itemWidth) * this.itemWidth + c;
	}

	// ---- velocity helper: averaged release velocity (noise fix) ------------
	_avgVelocity() {
		const s = this._velSamples;
		if (!s.length) return 0;
		let dx = 0,
			dt = 0;
		for (const sample of s) {
			dx += sample.dx;
			dt += sample.dt;
		}
		return dt > 0 ? dx / dt : 0; // px per ms
	}

	// ---- drivers -----------------------------------------------------------
	_onWheel(e) {
		e.preventDefault();
		this.target += e.deltaY;
		clearTimeout(this._wheelStop);
		this._wheelStop = setTimeout(() => this.settle(), this.opts.snapDelay);
	}

	_onPointerDown(e) {
		this.isDragging = true;
		this.lastPointerX = e.clientX;
		this._lastMoveTime = performance.now();
		this._velSamples.length = 0;
		this.container.setPointerCapture(e.pointerId);
		this.container.style.cursor = 'grabbing';
	}

	_onPointerMove(e) {
		if (!this.isDragging) return;
		const now = performance.now();
		const dx = e.clientX - this.lastPointerX;
		const dt = now - this._lastMoveTime;

		this.target += dx * this.opts.dragMultiplier;

		// keep a short moving window of samples for a stable release velocity
		this._velSamples.push({ dx, dt });
		if (this._velSamples.length > this.opts.velocitySamples) this._velSamples.shift();

		this.lastPointerX = e.clientX;
		this._lastMoveTime = now;
	}

	_onPointerUp(e) {
		if (!this.isDragging) return;
		this.isDragging = false;
		this.container.releasePointerCapture(e.pointerId);
		this.container.style.cursor = '';

		// project where the throw would land (D = v0 / (1 - friction)),
		// applying the SAME dragMultiplier so coast matches drag feel.
		const v = this._avgVelocity() * this.opts.dragMultiplier; // px/ms
		const vFrame = v * (1000 / 60); // px per 60fps frame
		const projected = this.target + vFrame * (1 / (1 - this.opts.friction));

		this.settle(projected);
	}

	// ---- render loop -------------------------------------------------------
	_frame(now) {
		const dt = (now - this._last) / 1000;
		this._last = now;

		// AUTOPLAY DRIVER: constant px/sec into target, paused during interaction.
		// Just another writer to `target` — composes with wheel/drag for free.
		if (this.opts.autoplay && !this.isDragging && !this._hovering) {
			this.target += this.opts.autoplaySpeed * dt;
		}

		const k = 1 - Math.pow(1 - this.opts.ease, dt * 60); // fps-independent ease
		this.current += (this.target - this.current) * k;
		this.render();
		if (this._running) this._raf = requestAnimationFrame(this._frame);
	}

	_onResize() {
		cancelAnimationFrame(this._resizePending);
		this._resizePending = requestAnimationFrame(() => this.measure());
	}

	// ---- default DOM renderer (factored out → swap target for WebGL) -------
	static domRenderer() {
		return {
			measure(items, gap) {
				return items[0].offsetWidth + gap;
			},
			apply(items, positions) {
				for (let i = 0; i < items.length; i++) {
					items[i].style.transform = `translate3d(${positions[i]}px,0,0)`;
				}
			},
		};
	}
}
