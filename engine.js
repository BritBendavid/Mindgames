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
    const parts = fen.trim().split(/\s+/);
    const boardPart = parts[0];
    const side = parts[1] || "w";

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

    this.sideToMove = side;
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

  oppositeColor(color) {
    return color === "w" ? "b" : "w";
  }

  clone() {
    const copy = new ChessEngine();
    copy.board = [...this.board];
    copy.sideToMove = this.sideToMove;
    return copy;
  }

  // Main public move generator.
  // The HTML can keep calling generateMoves().
  generateMoves() {
    return this.generateLegalMoves();
  }

  generateLegalMoves() {
    const pseudoMoves = this.generatePseudoLegalMoves();
    const legalMoves = [];
    const movingColor = this.sideToMove;

    for (const move of pseudoMoves) {
      const target = this.board[move.to];

      // In real chess, the king is never captured.
      // Checkmate means the king has no legal escape.
      if (target && target[1] === "K") {
        continue;
      }

      const position = this.clone();
      position.makeMove(move);

      if (!position.isInCheck(movingColor)) {
        legalMoves.push(move);
      }
    }

    return legalMoves;
  }

  generatePseudoLegalMoves() {
    const moves = [];

    for (let square = 0; square < 64; square++) {
      const piece = this.board[square];
      if (!piece) continue;
      if (this.getColor(piece) !== this.sideToMove) continue;

      const type = this.getType(piece);

      if (type === "P") this.generatePawnMoves(square, moves);
      if (type === "N") this.generateKnightMoves(square, moves);

      if (type === "B") {
        this.generateSlidingMoves(square, moves, [
          [1, 1], [1, -1], [-1, 1], [-1, -1]
        ]);
      }

      if (type === "R") {
        this.generateSlidingMoves(square, moves, [
          [1, 0], [-1, 0], [0, 1], [0, -1]
        ]);
      }

      if (type === "Q") {
        this.generateSlidingMoves(square, moves, [
          [1, 1], [1, -1], [-1, 1], [-1, -1],
          [1, 0], [-1, 0], [0, 1], [0, -1]
        ]);
      }

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

    if (this.inBounds(oneStepRow, col)) {
      const oneStepSquare = oneStepRow * 8 + col;

      if (!this.board[oneStepSquare]) {
        if (oneStepRow === promotionRow) {
          for (const promo of ["Q", "R", "B", "N"]) {
            moves.push({ from: square, to: oneStepSquare, promotion: promo });
          }
        } else {
          moves.push({ from: square, to: oneStepSquare });
        }

        const twoStepRow = row + direction * 2;

        if (row === startRow && this.inBounds(twoStepRow, col)) {
          const twoStepSquare = twoStepRow * 8 + col;

          if (!this.board[twoStepSquare]) {
            moves.push({ from: square, to: twoStepSquare });
          }
        }
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

  findKing(color) {
    const king = color + "K";

    for (let i = 0; i < 64; i++) {
      if (this.board[i] === king) {
        return i;
      }
    }

    return -1;
  }

  isInCheck(color) {
    const kingSquare = this.findKing(color);

    if (kingSquare === -1) {
      return true;
    }

    return this.isSquareAttacked(kingSquare, this.oppositeColor(color));
  }

  isSquareAttacked(square, byColor) {
    const row = Math.floor(square / 8);
    const col = square % 8;

    // Pawn attacks
    const pawnSourceRow = row + (byColor === "w" ? 1 : -1);

    for (const dc of [-1, 1]) {
      const pawnCol = col + dc;

      if (this.inBounds(pawnSourceRow, pawnCol)) {
        const pawnSquare = pawnSourceRow * 8 + pawnCol;
        if (this.board[pawnSquare] === byColor + "P") {
          return true;
        }
      }
    }

    // Knight attacks
    const knightJumps = [
      [2, 1], [2, -1],
      [-2, 1], [-2, -1],
      [1, 2], [1, -2],
      [-1, 2], [-1, -2],
    ];

    for (const [dr, dc] of knightJumps) {
      const r = row + dr;
      const c = col + dc;

      if (!this.inBounds(r, c)) continue;

      const piece = this.board[r * 8 + c];

      if (piece === byColor + "N") {
        return true;
      }
    }

    // King attacks
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;

        const r = row + dr;
        const c = col + dc;

        if (!this.inBounds(r, c)) continue;

        const piece = this.board[r * 8 + c];

        if (piece === byColor + "K") {
          return true;
        }
      }
    }

    // Bishop / queen diagonal attacks
    const diagonalDirections = [
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];

    for (const [dr, dc] of diagonalDirections) {
      let r = row + dr;
      let c = col + dc;

      while (this.inBounds(r, c)) {
        const piece = this.board[r * 8 + c];

        if (piece) {
          if (
            this.getColor(piece) === byColor &&
            (this.getType(piece) === "B" || this.getType(piece) === "Q")
          ) {
            return true;
          }

          break;
        }

        r += dr;
        c += dc;
      }
    }

    // Rook / queen straight attacks
    const straightDirections = [
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ];

    for (const [dr, dc] of straightDirections) {
      let r = row + dr;
      let c = col + dc;

      while (this.inBounds(r, c)) {
        const piece = this.board[r * 8 + c];

        if (piece) {
          if (
            this.getColor(piece) === byColor &&
            (this.getType(piece) === "R" || this.getType(piece) === "Q")
          ) {
            return true;
          }

          break;
        }

        r += dr;
        c += dc;
      }
    }

    return false;
  }

  makeMove(move) {
    const piece = this.board[move.from];

    this.board[move.to] = move.promotion
      ? piece[0] + move.promotion
      : piece;

    this.board[move.from] = EMPTY;

    this.sideToMove = this.sideToMove === "w" ? "b" : "w";
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
      if (this.isInCheck(this.sideToMove)) {
        return this.sideToMove === "w" ? -999999 : 999999;
      }

      return 0;
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

  perft(depth) {
    if (depth === 0) {
      return 1;
    }

    const moves = this.generateMoves();
    let nodes = 0;

    for (const move of moves) {
      const position = this.clone();
      position.makeMove(move);
      nodes += position.perft(depth - 1);
    }

    return nodes;
  }

  moveToString(move) {
    let text = this.squareToCoord(move.from) + this.squareToCoord(move.to);
    if (move.promotion) text += move.promotion.toLowerCase();
    return text;
  }
}

// Browser support for GitHub Pages
if (typeof window !== "undefined") {
  window.ChessEngine = ChessEngine;
}

// Optional Node.js support for local testing
if (typeof module !== "undefined") {
  module.exports = ChessEngine;
}
