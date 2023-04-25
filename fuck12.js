/*
	ISC License

	Copyright (c) 2023, aiden (aiden@cmp.bz)

	Permission to use, copy, modify, and/or distribute this software for any
	purpose with or without fee is hereby granted, provided that the above
	copyright notice and this permission notice appear in all copies.

	THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
	WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
	MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
	ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
	WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
	ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
	OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/

// (horizonatal scrolling not implemented btw)
class Fuck12 {
	static NO_SET_HASH = 0b00;
	static CONTENT_HASH = 0b01;
	static BASE_HEADER_HASH = 0b10;
	static HASH_MODE_MASK = 0b11;
	static FIRST_ELEMENT_NO_HASH = 1 << 2;

	static NO_ACTIVATE_AFTER = 0;
	static ACTIVE_TO_DEEPEST = 1;
	static ACTIVATE_TO_DEEPEST_GREEDY = 2;

	static HEADER_ABOVE_BASE = -1;
	static HEADER_BASE = 0;
	static HEADER_BENEATH_BASE = 1;
	static CONTENT = null;
	
	static setHash(el) {
		if (!el.id.length) {
			return false;
		}
		history.replaceState({}, "", "#" + encodeURIComponent(el.id));
		return true;
	}
	static removeHash() {
		history.replaceState({}, "", location.href.substring(0, location.href.indexOf("#")));
		return;
	}
	static depth(depthStr) {
		let n = Number(depthStr);
		if (!Number.isInteger(n) || n < 0) {
			throw new Error("invalid depth");
		}
		return n;
	}
	static hashEl() {
		if (location.hash.length <= 1) {
			throw new Error("no meaningful hash");
		}
		let el = document.getElementById(decodeURIComponent(location.hash.substr(1)));
		if (!el) {
			throw new Error("no hash element");
		}
		return el;
	}

	observer = null;
	observedActiveElems = [];
	signalEl = document.createElement("br");
	sentSignal = false;
	csp = null;
	activateCallback = null;
	deactivateCallback = null;
	activateAfterMode = null;
	content = null;

	signal() {
		this.sentSignal = true;
		this.observer.observe(this.signalEl);
	}

	hashchange = _ => {
		try {
			var el = Fuck12.hashEl();
		} catch {
			return;
		}

		this.signal();

		this.processEl({
			targetEl: el,
			activateAfterMode: this.activateAfterMode,
			hashMode: Fuck12.NO_SET_HASH,
		});
		return;
	}
	activate = (el, rel, depth) => {
		this.observedActiveElems.push(el);
		el.dataset.observedActive = true;
		this.activateCallback?.(el, rel, depth);
		return;
	}
	deactivate = el => {
		delete el.dataset.observedActive;
		this.deactivateCallback?.(el);
		return;
	}
	processEl = ({ targetEl, activateAfterMode, hashMode, }) => {
		let
			baseEl = null,
			baseDepth = null;

		if (targetEl === this.content.firstElementChild && (hashMode & Fuck12.FIRST_ELEMENT_NO_HASH)) {
			hashMode = Fuck12.NO_SET_HASH;
			Fuck12.removeHash();
		}

		// find a header
		for (
			let el = targetEl, contentEl = null;;
			el = el.previousElementSibling
		) {
			if (!el) {
				return;
			}
			if ((hashMode & Fuck12.HASH_MODE_MASK) === Fuck12.CONTENT_HASH) {
				if (Fuck12.setHash(el)) {
					contentEl = el;
					hashMode = Fuck12.NO_SET_HASH;
				} else {
					hashMode = (hashMode & ~Fuck12.HASH_MODE_MASK) | Fuck12.BASE_HEADER_HASH;
				}
			}

			try {
				var elDepth = Fuck12.depth(el.dataset.depth);
			} catch {
				continue;
			}

			// deactivate old elements
			for (let old; old = this.observedActiveElems.pop();) {
				this.deactivate(old);
			}

			if ((hashMode & Fuck12.HASH_MODE_MASK) === Fuck12.BASE_HEADER_HASH) {
				Fuck12.setHash(el);
			}
			if (contentEl) {
				this.activate(contentEl, Fuck12.CONTENT, null);
			}
			this.activate(el, Fuck12.HEADER_BASE, elDepth);

			baseEl = el;
			baseDepth = elDepth;

			break;
		}

		// find deepest element
		if (activateAfterMode !== Fuck12.NO_ACTIVATE_AFTER) {
			for (
				let el =
					baseEl.nextElementSibling, currDepth = baseDepth;
				el;
				el = el.nextElementSibling
			) {
				try {
					var elDepth = Fuck12.depth(el.dataset.depth);
				} catch {
					if (activateAfterMode === Fuck12.ACTIVATE_TO_DEEPEST_GREEDY) {
						continue;
					} else /* Fuck12.ACTIVE_TO_DEEPEST */ {
						break;
					}
				}
				
				if (elDepth !== currDepth + 1) {
					break;
				}
				currDepth += 1;

				// to-do: maybe set hash here if setHash hasn't already succeeded
				this.activate(el, Fuck12.HEADER_BENEATH_BASE, elDepth);
			}
		}

		// find surface element
		for (
			let
				el = baseEl.previousElementSibling,
				currDepth = baseDepth;
			el && currDepth > 0;
			el = el.previousElementSibling
		) {
			try {
				var elDepth = Fuck12.depth(el.dataset.depth);
			} catch {
				continue;
			}

			if (elDepth !== currDepth - 1) {
				continue;
			}
			currDepth -= 1;

			// to-do: maybe set hash here if setHash hasn't already succeeded
			this.activate(el, Fuck12.HEADER_ABOVE_BASE, elDepth);
		}
	
		return;
	}

	constructor({
		content, threshold = 0,
		hashMode = Fuck12.NO_SET_HASH,
		activateAfterMode = Fuck12.ACTIVATE_TO_DEEPEST_GREEDY,
		activateCallback = null,
		deactivateCallback = null,
		registerHashchange = true,
	} = {}) {
		if (!(content instanceof HTMLElement)) {
			throw new TypeError("content must be an instance of HTMLElement");
		}

		let m = hashMode & Fuck12.HASH_MODE_MASK;
		if (m < Fuck12.NO_SET_HASH || m > Fuck12.BASE_HEADER_HASH) {
			throw new RangeError("invalid value for hashMode");
		}
		if (hashMode & ~(Fuck12.HASH_MODE_MASK | Fuck12.FIRST_ELEMENT_NO_HASH)) {
			throw new Error("invalid flag set on hashMode");
		}
		if (activateAfterMode < Fuck12.NO_ACTIVATE_AFTER || activateAfterMode > Fuck12.ACTIVATE_TO_DEEPEST_GREEDY) {
			throw new RangeError("invalid value for activateAfterMode");
		}

		this.csp = content.scrollTop;
		this.observer = new IntersectionObserver(entries => {
			let sp = this.csp;
			this.csp = content.scrollTop;
			if (this.sentSignal) {
				this.observer.unobserve(this.signalEl);
				this.sentSignal = false;
				return;
			}
			for (let entry of entries) {
				let target = entry.target;
				if (entry.isIntersecting) {
					if (this.csp <= sp) {
						this.processEl({
							targetEl: target,
							activateAfterMode,
							hashMode,
						});
						break;
					}
				} else if (entry.boundingClientRect.bottom <= content.clientHeight) {
					// element goes OFF THE TOP OF THE VIEWPORT
					let el = target.nextElementSibling;
					if (el) {
						this.processEl({
							targetEl: el,
							activateAfterMode,
							hashMode,
						});
					}
				} else if (target.dataset.observedActive) {
					// element goes OFF THE BOTTOM OF THE VIEWPORT
					let el = target.previousElementSibling;
					if (el) {
						this.processEl({
							targetEl: el,
							activateAfterMode,
							hashMode,
						});
					}
				}
			}
			return;
		}, {
			root: content,
			threshold: threshold,
		});

		for (let el of content.children) {
			this.observer.observe(el);
		}

		this.activateAfterMode = activateAfterMode;
		this.activateCallback = activateCallback;
		this.deactivateCallback = deactivateCallback;

		this.content = content;

		if (registerHashchange) {
			window.addEventListener("hashchange", this.hashchange);
		}
	}
	destructor() {
		this.observer.disconnect();
		this.observer = null;
		window.removeEventListener("hashchange", this.hashchange);
		for (let el; el = this.observedActiveElems.pop();) {
			this.deactivate(el);
		}
		this.signalEl = null;
		this.content = null;
		this.activateCallback = null;
		this.deactivateCallback = null;
		this.observedActiveElems = null;

		return;
	}
}