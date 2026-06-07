/**
 * @param {number[]} nums
 * @return {number[]}
 */
var productExceptSelf = function (nums) {
    const n = nums.length;
    let res = [];
    // 计算所有左侧和右侧的乘积
    const l = [1];
    // l = [1,1,2,6]
    for (let i = 1; i < n; i++) {
        l[i] = l[i - 1] * nums[i - 1];
    }
    const right = new Array(4).fill(1);
    // right = [24,12,4,1]
    for (let j = n - 2; j >= 0; j--) {
        right[j] = right[j + 1] * nums[j + 1];
    }
    return right;
    for (let k = 0; k < n; k++) {
        res[k] = l[k] * right[k];
    }
    return res;
};
console.log("productExceptSelf()", productExceptSelf([1, 2, 3, 4]));
