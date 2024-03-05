
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('数学库测试', () => {
    it('最大值测试', () => {
        const result = Math.max(-1, 2, 3);
        expect(result).to.equal(3);
    });
});