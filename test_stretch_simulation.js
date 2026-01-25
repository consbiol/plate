
const height = 100; // Example height

function simulate(height) {
    const expandedRowMapArr = [];
    let accumulated = 0;

    console.log("y\tdist\tfactor\trepeats");

    for (let y = 0; y < height; y++) {
        const distTop = y;
        const distBottom = height - 1 - y;
        const minDist = Math.min(distTop, distBottom);

        // 1-2 pixels (indices 0-1) -> 5.0x
        // 3-5 pixels (indices 2-4) -> 3.0x
        // 6-15 pixels (indices 5-14) -> 2.0x
        // 16-30 pixels (indices 15-29) -> 1.3x

        let factor = 1.0;
        if (minDist <= 1) factor = 5.0;      // 0, 1 (2 rows)
        else if (minDist <= 4) factor = 3.0; // 2..4 (3 rows)
        else if (minDist <= 14) factor = 2.0;// 5..14 (10 rows)
        else if (minDist <= 29) factor = 1.3;// 15..29 (15 rows)

        accumulated += factor;
        let count = 0;
        while (accumulated >= 1) {
            expandedRowMapArr.push(y);
            accumulated -= 1;
            count++;
        }

        if (minDist <= 20) { // Limit output
            // console.log(`${y}\t${minDist}\t${factor}\t${count}`);
        }
    }

    return expandedRowMapArr.length;
}

const len = simulate(height);
console.log(`Original height: ${height}`);
console.log(`Stretched height: ${len}`);

// Theoretical calculation:
// 2 rows * 5 = 10
// 3 rows * 3 = 9
// 10 rows * 2 = 20
// 15 rows * 1.3 = 19.5 -> ~19 or 20
// Remaining rows = 100 - (2+3+10+15)*2 = 100 - 60 = 40 rows (factor 1) -> 40
// Total ~ 10 + 9 + 20 + 20 + 40 = 99 per side?? No.
// Let's sum one side (0..49)
// 0,1: 2 * 5 = 10
// 2,3,4: 3 * 3 = 9
// 5..14: 10 * 2 = 20
// 15..29: 15 * 1.3 = 19.5
// 30..49: 20 * 1 = 20
// Total for top half: 10+9+20+19.5+20 = 78.5
// Total total: 78.5 * 2 = 157.
