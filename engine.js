// engine.js

const EMPTY = null;

const PIECE_VALUES = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 20000,
};

class ChessEngine {
  constructor() {
    this.board = new Array(64).fill(EMPTY);
    this.sideToMove = "w";
  }

  loadFEN(fen) {
    const [boardPart, side] = fen.split(" ");
    this.board.fill(EMPTY);

    let square = 0;

    for (const char of boardPart) {
      if (char === "/") continue;

      if (/\d/.test(char)) {
        square += Number(char);
      } else {
        const color = char === char.toUpperCase() ? "w" : "b";
        const type = char.toUpperCase();
        this.board[square] = color + type;
        square++;
      }
    }

    this.sideToMove = side || "w";
  }

  printBoard() {
    for (let r = 0; r < 8; r++) {
      let row = "";
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r * 8 + c];
        row += piece ? piece + " " : ".. ";
      }
      console.log(row);
    }
    console.log("Side to move:", this.sideToMove);
  }

  squareToCoord(square) {
    const file = square % 8;
    const rank = 8 - Math.floor(square / 8);
    return "abcdefgh"[file] + rank;
  }

  coordToSquare(coord) {
    const file = "abcdefgh".indexOf(coord[0]);
    const rank = 8 - Number(coord[1]);
    return rank * 8 + file;
  }

  inBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  getColor(piece) {
    return piece ? piece[0] : null;
  }

  getType(piece) {
    return piece ? piece[1] : null;
  }

  generateMoves() {
    const moves = [];

    for (let square = 0; square < 64; square++) {
      const piece = this.board[square];
      if (!piece) continue;
      if (this.getColor(piece) !== this.sideToMove) continue;

      const type = this.getType(piece);

      if (type === "P") this.generatePawnMoves(square, moves);
      if (type === "N") this.generateKnightMoves(square, moves);
      if (type === "B") this.generateSlidingMoves(square, moves, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
      if (type === "R") this.generateSlidingMoves(square, moves, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
      if (type === "Q") this.generateSlidingMoves(square, moves, [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]);
      if (type === "K") this.generateKingMoves(square, moves);
    }

    return moves;
  }

  generatePawnMoves(square, moves) {
    const piece = this.board[square];
    const color = this.getColor(piece);

    const row = Math.floor(square / 8);
    const col = square % 8;

    const direction = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const promotionRow = color === "w" ? 0 : 7;

    const oneStepRow = row + direction;
    const oneStepSquare = oneStepRow * 8 + col;

    if (this.inBounds(oneStepRow, col) && !this.board[oneStepSquare]) {
      if (oneStepRow === promotionRow) {
        for (const promo of ["Q", "R", "B", "N"]) {
          moves.push({ from: square, to: oneStepSquare, promotion: promo });
        }
      } else {
        moves.push({ from: square, to: oneStepSquare });
      }

      const twoStepRow = row + direction * 2;
      const twoStepSquare = twoStepRow * 8 + col;

      if (row === startRow && !this.board[twoStepSquare]) {
        moves.push({ from: square, to: twoStepSquare });
      }
    }

    for (const dc of [-1, 1]) {
      const captureRow = row + direction;
      const captureCol = col + dc;

      if (!this.inBounds(captureRow, captureCol)) continue;

      const targetSquare = captureRow * 8 + captureCol;
      const target = this.board[targetSquare];

      if (target && this.getColor(target) !== color) {
        if (captureRow === promotionRow) {
          for (const promo of ["Q", "R", "B", "N"]) {
            moves.push({ from: square, to: targetSquare, promotion: promo });
          }
        } else {
          moves.push({ from: square, to: targetSquare });
        }
      }
    }
  }

  generateKnightMoves(square, moves) {
    const piece = this.board[square];
    const color = this.getColor(piece);

    const row = Math.floor(square / 8);
    const col = square % 8;

    const jumps = [
      [2, 1], [2, -1],
      [-2, 1], [-2, -1],
      [1, 2], [1, -2],
      [-1, 2], [-1, -2],
    ];

    for (const [dr, dc] of jumps) {
      const r = row + dr;
      const c = col + dc;

      if (!this.inBounds(r, c)) continue;

      const targetSquare = r * 8 + c;
      const target = this.board[targetSquare];

      if (!target || this.getColor(target) !== color) {
        moves.push({ from: square, to: targetSquare });
      }
    }
  }

  generateSlidingMoves(square, moves, directions) {
    const piece = this.board[square];
    const color = this.getColor(piece);

    const row = Math.floor(square / 8);
    const col = square % 8;

    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;

      while (this.inBounds(r, c)) {
        const targetSquare = r * 8 + c;
        const target = this.board[targetSquare];

        if (!target) {
          moves.push({ from: square, to: targetSquare });
        } else {
          if (this.getColor(target) !== color) {
            moves.push({ from: square, to: targetSquare });
          }
          break;
        }

        r += dr;
        c += dc;
      }
    }
  }

  generateKingMoves(square, moves) {
    const piece = this.board[square];
    const color = this.getColor(piece);

    const row = Math.floor(square / 8);
    const col = square % 8;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;

        const r = row + dr;
        const c = col + dc;

        if (!this.inBounds(r, c)) continue;

        const targetSquare = r * 8 + c;
        const target = this.board[targetSquare];

        if (!target || this.getColor(target) !== color) {
          moves.push({ from: square, to: targetSquare });
        }
      }
    }
  }

  makeMove(move) {
    const piece = this.board[move.from];

    this.board[move.to] = move.promotion
      ? piece[0] + move.promotion
      : piece;

    this.board[move.from] = EMPTY;
    this.sideToMove = this.sideToMove === "w" ? "b" : "w";
  }

  clone() {
    const copy = new ChessEngine();
    copy.board = [...this.board];
    copy.sideToMove = this.sideToMove;
    return copy;
  }

  evaluate() {
    let score = 0;

    for (const piece of this.board) {
      if (!piece) continue;

      const color = this.getColor(piece);
      const type = this.getType(piece);
      const value = PIECE_VALUES[type];

      score += color === "w" ? value : -value;
    }

    return score;
  }

  search(depth) {
    if (depth === 0) {
      return this.evaluate();
    }

    const moves = this.generateMoves();

    if (moves.length === 0) {
      return this.evaluate();
    }

    if (this.sideToMove === "w") {
      let bestScore = -Infinity;

      for (const move of moves) {
        const position = this.clone();
        position.makeMove(move);
        const score = position.search(depth - 1);
        bestScore = Math.max(bestScore, score);
      }

      return bestScore;
    } else {
      let bestScore = Infinity;

      for (const move of moves) {
        const position = this.clone();
        position.makeMove(move);
        const score = position.search(depth - 1);
        bestScore = Math.min(bestScore, score);
      }

      return bestScore;
    }
  }

  findBestMove(depth) {
    const moves = this.generateMoves();
    let bestMove = null;

    let bestScore = this.sideToMove === "w" ? -Infinity : Infinity;

    for (const move of moves) {
      const position = this.clone();
      position.makeMove(move);

      const score = position.search(depth - 1);

      if (this.sideToMove === "w" && score > bestScore) {
        bestScore = score;
        bestMove = move;
      }

      if (this.sideToMove === "b" && score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return { move: bestMove, score: bestScore };
  }

  moveToString(move) {
    let text = this.squareToCoord(move.from) + this.squareToCoord(move.to);
    if (move.promotion) text += move.promotion.toLowerCase();
    return text;
  }
}

// Starting position
/*const engine = new ChessEngine();

engine.loadFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w");

engine.printBoard();

const moves = engine.generateMoves();

console.log("Legal-ish moves:");
console.log(moves.map(m => engine.moveToString(m)).join(" "));
console.log("Move count:", moves.length);

const best = engine.findBestMove(3);

console.log("Best move:", engine.moveToString(best.move));
console.log("Score:", best.score);*/
