import test from 'node:test';
import assert from 'node:assert/strict';

import { getDropdownPosition } from '../src/core/utils/dropdown-position.js';

test('getDropdownPosition places menu below button when there is room', () => {
	const rect = {
		left: 100,
		right: 180,
		top: 40,
		bottom: 72
	};

	const result = getDropdownPosition({
		rect,
		menuWidth: 120,
		menuHeight: 160,
		viewportWidth: 400,
		viewportHeight: 500,
		gap: 4
	});

	assert.deepEqual(result, { left: 100, top: 76 });
});

test('getDropdownPosition repositions menu to stay inside viewport bounds', () => {
	const rect = {
		left: 260,
		right: 320,
		top: 150,
		bottom: 182
	};

	const result = getDropdownPosition({
		rect,
		menuWidth: 140,
		menuHeight: 170,
		viewportWidth: 360,
		viewportHeight: 300,
		gap: 4
	});

	assert.deepEqual(result, { left: 180, top: 10 });
});

test('getDropdownPosition clamps menu inside top-left viewport padding', () => {
	const rect = {
		left: -20,
		right: 20,
		top: 6,
		bottom: 18
	};

	const result = getDropdownPosition({
		rect,
		menuWidth: 80,
		menuHeight: 40,
		viewportWidth: 120,
		viewportHeight: 50,
		gap: 4
	});

	assert.deepEqual(result, { left: 10, top: 10 });
});
