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

    this.castlingRights = "KQkq";
    this.enPassantSquare = null;
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;
    this.positionHistory = [];
  }

  loadFEN(fen) {
    const parts = fen.trim().split(/\s+/);

    const boardPart = parts[0];

    this.sideToMove = parts[1] || "w";

    if (parts[2] === undefined) {
      this.castlingRights = "KQkq";
    } else {
      this.castlingRights = parts[2] !== "-" ? parts[2] : "";
    }

    this.enPassantSquare =
      parts[3] && parts[3] !== "-" ? this.coordToSquare(parts[3]) : null;

    this.halfmoveClock = parts[4] ? Number(parts[4]) : 0;
    this.fullmoveNumber = parts[5] ? Number(parts[5]) : 1;

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

    this.positionHistory = [this.getPositionKey()];
  }

  clone() {
    const copy = new ChessEngine();

    copy.board = [...this.board];
    copy.sideToMove = this.sideToMove;
    copy.castlingRights = this.castlingRights;
    copy.enPassantSquare = this.enPassantSquare;
    copy.halfmoveClock = this.halfmoveClock;
    copy.fullmoveNumber = this.fullmoveNumber;
    copy.positionHistory = [...this.positionHistory];

    return copy;
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

  squareRow(square) {
    return Math.floor(square / 8);
  }

  squareCol(square) {
    return square % 8;
  }

  squareColor(square) {
    return (this.squareRow(square) + this.squareCol(square)) % 2;
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

  sameRankOrFile(a, b) {
    return (
      this.squareRow(a) === this.squareRow(b) ||
      this.squareCol(a) === this.squareCol(b)
    );
  }

  dedupeSquares(squares) {
    return [...new Set(squares)];
  }

  lineBetweenStrict(from, to) {
    const fromRow = this.squareRow(from);
    const fromCol = this.squareCol(from);
    const toRow = this.squareRow(to);
    const toCol = this.squareCol(to);

    const sameRow = fromRow === toRow;
    const sameCol = fromCol === toCol;

    if (!sameRow && !sameCol) return [];

    const dr = Math.sign(toRow - fromRow);
    const dc = Math.sign(toCol - fromCol);

    const squares = [];

    let r = fromRow + dr;
    let c = fromCol + dc;

    while (r !== toRow || c !== toCol) {
      squares.push(r * 8 + c);
      r += dr;
      c += dc;
    }

    return squares;
  }

  generateMoves() {
    return this.generateLegalMoves();
  }

  generateLegalMoves() {
    const pseudoMoves = this.generatePseudoLegalMoves();
    const legalMoves = [];
    const movingColor = this.sideToMove;

    for (const move of pseudoMoves) {
      const target = this.board[move.to];

      // In legal chess, kings are never captured.
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
          [1, 1], [1, -1], [-1, 1], [-1, -1],
        ]);
      }

      if (type === "R") {
        this.generateSlidingMoves(square, moves, [
          [1, 0], [-1, 0], [0, 1], [0, -1],
        ]);
      }

      if (type === "Q") {
        this.generateSlidingMoves(square, moves, [
          [1, 1], [1, -1], [-1, 1], [-1, -1],
          [1, 0], [-1, 0], [0, 1], [0, -1],
        ]);
      }

      if (type === "K") {
        this.generateKingMoves(square, moves);
      }
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
            moves.push({
              from: square,
              to: twoStepSquare,
              doublePawnPush: true,
            });
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

      if (this.enPassantSquare === targetSquare) {
        moves.push({
          from: square,
          to: targetSquare,
          enPassant: true,
        });
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

    this.generateCastlingMoves(square, moves);
  }

  generateCastlingMoves(square, moves) {
    const color = this.sideToMove;
    const enemy = this.oppositeColor(color);

    if (this.isInCheck(color)) return;

    if (color === "w" && square === 60) {
      if (
        this.castlingRights.includes("K") &&
        this.board[63] === "wR" &&
        !this.board[61] &&
        !this.board[62] &&
        !this.isSquareAttacked(61, enemy) &&
        !this.isSquareAttacked(62, enemy)
      ) {
        moves.push({ from: 60, to: 62, castle: "K" });
      }

      if (
        this.castlingRights.includes("Q") &&
        this.board[56] === "wR" &&
        !this.board[59] &&
        !this.board[58] &&
        !this.board[57] &&
        !this.isSquareAttacked(59, enemy) &&
        !this.isSquareAttacked(58, enemy)
      ) {
        moves.push({ from: 60, to: 58, castle: "Q" });
      }
    }

    if (color === "b" && square === 4) {
      if (
        this.castlingRights.includes("k") &&
        this.board[7] === "bR" &&
        !this.board[5] &&
        !this.board[6] &&
        !this.isSquareAttacked(5, enemy) &&
        !this.isSquareAttacked(6, enemy)
      ) {
        moves.push({ from: 4, to: 6, castle: "k" });
      }

      if (
        this.castlingRights.includes("q") &&
        this.board[0] === "bR" &&
        !this.board[3] &&
        !this.board[2] &&
        !this.board[1] &&
        !this.isSquareAttacked(3, enemy) &&
        !this.isSquareAttacked(2, enemy)
      ) {
        moves.push({ from: 4, to: 2, castle: "q" });
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

      if (this.board[r * 8 + c] === byColor + "N") {
        return true;
      }
    }

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;

        const r = row + dr;
        const c = col + dc;

        if (!this.inBounds(r, c)) continue;

        if (this.board[r * 8 + c] === byColor + "K") {
          return true;
        }
      }
    }

    const diagonalDirections = [
      [1, 1], [1, -1], [-1, 1], [-1, -1],
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

    const straightDirections = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
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
    const color = this.getColor(piece);
    const type = this.getType(piece);
    const capturedPiece = this.board[move.to];

    this.updateCastlingRights(move, piece, capturedPiece);

    this.board[move.to] = move.promotion
      ? color + move.promotion
      : piece;

    this.board[move.from] = EMPTY;

    if (move.enPassant) {
      const capturedPawnSquare = color === "w" ? move.to + 8 : move.to - 8;
      this.board[capturedPawnSquare] = EMPTY;
    }

    if (move.castle) {
      if (move.castle === "K") {
        this.board[61] = this.board[63];
        this.board[63] = EMPTY;
      }

      if (move.castle === "Q") {
        this.board[59] = this.board[56];
        this.board[56] = EMPTY;
      }

      if (move.castle === "k") {
        this.board[5] = this.board[7];
        this.board[7] = EMPTY;
      }

      if (move.castle === "q") {
        this.board[3] = this.board[0];
        this.board[0] = EMPTY;
      }
    }

    if (type === "P" && Math.abs(move.to - move.from) === 16) {
      this.enPassantSquare = (move.from + move.to) / 2;
    } else {
      this.enPassantSquare = null;
    }

    if (type === "P" || capturedPiece || move.enPassant) {
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock++;
    }

    if (this.sideToMove === "b") {
      this.fullmoveNumber++;
    }

    this.sideToMove = this.oppositeColor(this.sideToMove);
    this.recordPosition();
  }

  updateCastlingRights(move, piece, capturedPiece) {
    if (!piece) return;

    const remove = rights => {
      for (const r of rights) {
        this.castlingRights = this.castlingRights.replace(r, "");
      }
    };

    const type = this.getType(piece);

    if (type === "K") {
      if (this.getColor(piece) === "w") remove("KQ");
      if (this.getColor(piece) === "b") remove("kq");
    }

    if (type === "R") {
      if (move.from === 63) remove("K");
      if (move.from === 56) remove("Q");
      if (move.from === 7) remove("k");
      if (move.from === 0) remove("q");
    }

    if (capturedPiece && this.getType(capturedPiece) === "R") {
      if (move.to === 63) remove("K");
      if (move.to === 56) remove("Q");
      if (move.to === 7) remove("k");
      if (move.to === 0) remove("q");
    }
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

    if (move.promotion) {
      text += move.promotion.toLowerCase();
    }

    return text;
  }

  getPositionKey() {
    const boardPart = this.board.map(piece => piece || ".").join("");

    const ep = this.enPassantSquare === null
      ? "-"
      : this.squareToCoord(this.enPassantSquare);

    return [
      boardPart,
      this.sideToMove,
      this.castlingRights || "-",
      ep
    ].join(" ");
  }

  recordPosition() {
    this.positionHistory.push(this.getPositionKey());
  }

  isThreefoldRepetition() {
    const currentKey = this.getPositionKey();

    let count = 0;

    for (const key of this.positionHistory) {
      if (key === currentKey) {
        count++;
      }
    }

    return count >= 3;
  }

  isFiftyMoveRule() {
    return this.halfmoveClock >= 100;
  }

  isInsufficientMaterial() {
    const pieces = [];

    for (let square = 0; square < 64; square++) {
      const piece = this.board[square];

      if (piece) {
        pieces.push({ piece, square });
      }
    }

    const nonKings = pieces.filter(p => p.piece[1] !== "K");

    if (nonKings.length === 0) {
      return true;
    }

    if (nonKings.length === 1) {
      const type = nonKings[0].piece[1];
      return type === "B" || type === "N";
    }

    if (nonKings.length === 2) {
      const bothBishops = nonKings.every(p => p.piece[1] === "B");

      if (bothBishops) {
        const colors = nonKings.map(p => {
          const row = Math.floor(p.square / 8);
          const col = p.square % 8;
          return (row + col) % 2;
        });

        return colors[0] === colors[1];
      }
    }

    return false;
  }

  getGameStatus() {
    const legalMoves = this.generateMoves();
    const inCheck = this.isInCheck(this.sideToMove);

    if (legalMoves.length === 0) {
      if (inCheck) {
        return {
          over: true,
          type: "checkmate",
          message: this.sideToMove === "w"
            ? "Checkmate. Black wins."
            : "Checkmate. White wins."
        };
      }

      return {
        over: true,
        type: "stalemate",
        message: "Draw by stalemate."
      };
    }

    if (this.isFiftyMoveRule()) {
      return {
        over: true,
        type: "fifty-move",
        message: "Draw by fifty-move rule."
      };
    }

    if (this.isThreefoldRepetition()) {
      return {
        over: true,
        type: "threefold",
        message: "Draw by threefold repetition."
      };
    }

    if (this.isInsufficientMaterial()) {
      return {
        over: true,
        type: "insufficient-material",
        message: "Draw by insufficient material."
      };
    }

    if (inCheck) {
      return {
        over: false,
        type: "check",
        message: this.sideToMove === "w"
          ? "White is in check."
          : "Black is in check."
      };
    }

    return {
      over: false,
      type: "ongoing",
      message: "Game ongoing."
    };
  }

  // ============================================================
  // DISTANCE TO BLACK KING ANALYSIS
  // Currently only White knights and White rooks are calculated.
  // ============================================================

  analyzeWhitePathsToBlackKing() {
    const blackKing = this.findKing("b");

    if (blackKing === -1) {
      return {
        target: null,
        targetCoord: null,
        results: [],
        summary: "No Black king found."
      };
    }

    const results = [];

    for (let from = 0; from < 64; from++) {
      const piece = this.board[from];

      if (!piece) continue;
      if (this.getColor(piece) !== "w") continue;

      if (piece === "wN") {
        results.push(this.analyzeKnightPathToTarget(from, blackKing));
      }

      if (piece === "wR") {
        results.push(this.analyzeRookPathToTarget(from, blackKing));
      }
    }

    results.sort((a, b) => {
      const aTotal = Number.isFinite(a.totalEstimatedMoves)
        ? a.totalEstimatedMoves
        : Infinity;

      const bTotal = Number.isFinite(b.totalEstimatedMoves)
        ? b.totalEstimatedMoves
        : Infinity;

      if (aTotal !== bTotal) return aTotal - bTotal;

      const aEmpty = Number.isFinite(a.emptyBoardDistance)
        ? a.emptyBoardDistance
        : Infinity;

      const bEmpty = Number.isFinite(b.emptyBoardDistance)
        ? b.emptyBoardDistance
        : Infinity;

      return aEmpty - bEmpty;
    });

    return {
      target: blackKing,
      targetCoord: this.squareToCoord(blackKing),
      results,
      summary:
        "Distance-to-king analysis for White knights and rooks against Black king on " +
        this.squareToCoord(blackKing) +
        "."
    };
  }

  // -----------------------------
  // Knight formula
  // -----------------------------

  analyzeKnightPathToTarget(from, target) {
    const distance = this.knightDistanceFormula(from, target);

    return {
      piece: "wN",
      type: "N",
      from,
      fromCoord: this.squareToCoord(from),
      target,
      targetCoord: this.squareToCoord(target),
      emptyBoardDistance: distance,
      blockedBoardDistance: distance,
      extraBlockerCost: 0,
      totalEstimatedMoves: distance,
      blockers: [],
      note: "Knight distance is calculated by formula. Blockers are ignored because knights jump."
    };
  }

  knightDistanceFormula(from, target) {
    let dx = Math.abs(this.squareCol(from) - this.squareCol(target));
    let dy = Math.abs(this.squareRow(from) - this.squareRow(target));

    if (dx < dy) {
      const temp = dx;
      dx = dy;
      dy = temp;
    }

    if (dx === 0 && dy === 0) return 0;

    // Standard knight-distance exceptions.
    if (dx === 1 && dy === 0) return 3;
    if (dx === 2 && dy === 2) return 4;

    let distance = Math.max(
      Math.ceil(dx / 2),
      Math.ceil((dx + dy) / 3)
    );

    if ((distance + dx + dy) % 2 !== 0) {
      distance++;
    }

    return distance;
  }

  // -----------------------------
  // Rook formula
  // -----------------------------

  analyzeWhiteRooksToBlackKing() {
    const blackKing = this.findKing("b");

    if (blackKing === -1) {
      return {
        target: null,
        targetCoord: null,
        results: [],
        summary: "No Black king found."
      };
    }

    const results = [];

    for (let from = 0; from < 64; from++) {
      const piece = this.board[from];

      if (piece !== "wR") continue;

      results.push(this.analyzeRookPathToTarget(from, blackKing));
    }

    results.sort((a, b) => {
      if (a.totalEstimatedMoves !== b.totalEstimatedMoves) {
        return a.totalEstimatedMoves - b.totalEstimatedMoves;
      }

      return a.extraBlockerCost - b.extraBlockerCost;
    });

    return {
      target: blackKing,
      targetCoord: this.squareToCoord(blackKing),
      results,
      summary:
        "Rook path analysis to Black king on " +
        this.squareToCoord(blackKing) +
        "."
    };
  }

  analyzeRookPathToTarget(from, target) {
    const paths = this.getRookCandidatePaths(from, target);

    const analyzedPaths = paths.map(path =>
      this.analyzeRookCandidatePath(path)
    );

    analyzedPaths.sort((a, b) => {
      if (a.totalEstimatedMoves !== b.totalEstimatedMoves) {
        return a.totalEstimatedMoves - b.totalEstimatedMoves;
      }

      return a.extraBlockerCost - b.extraBlockerCost;
    });

    const bestPath = analyzedPaths[0];

    return {
      piece: "wR",
      type: "R",
      from,
      fromCoord: this.squareToCoord(from),
      target,
      targetCoord: this.squareToCoord(target),
      emptyBoardDistance: this.sameRankOrFile(from, target) ? 1 : 2,
      blockedBoardDistance: bestPath.totalEstimatedMoves,
      extraBlockerCost: bestPath.extraBlockerCost,
      totalEstimatedMoves: bestPath.totalEstimatedMoves,
      bestPath,
      paths: analyzedPaths,
      note: "Rook distance is formula-based: direct lines, L-paths, and optional same-line detours."
    };
  }

  getRookCandidatePaths(from, target) {
    const fromRow = this.squareRow(from);
    const fromCol = this.squareCol(from);
    const targetRow = this.squareRow(target);
    const targetCol = this.squareCol(target);

    const paths = [];

    if (from === target) {
      return [{
        name: "already on target",
        from,
        target,
        emptyMoves: 0,
        pivots: [],
        segments: []
      }];
    }

    if (fromRow === targetRow || fromCol === targetCol) {
      paths.push({
        name: "direct",
        from,
        target,
        emptyMoves: 1,
        pivots: [],
        segments: [
          { from, to: target }
        ]
      });

      // Same file: optional three-move file detours.
      if (fromCol === targetCol) {
        for (let detourCol = 0; detourCol < 8; detourCol++) {
          if (detourCol === fromCol) continue;

          const p1 = fromRow * 8 + detourCol;
          const p2 = targetRow * 8 + detourCol;

          paths.push({
            name:
              "three-move file detour via " +
              this.squareToCoord(p1) +
              " and " +
              this.squareToCoord(p2),
            from,
            target,
            emptyMoves: 3,
            pivots: [p1, p2],
            segments: [
              { from, to: p1 },
              { from: p1, to: p2 },
              { from: p2, to: target }
            ]
          });
        }
      }

      // Same rank: optional three-move rank detours.
      if (fromRow === targetRow) {
        for (let detourRow = 0; detourRow < 8; detourRow++) {
          if (detourRow === fromRow) continue;

          const p1 = detourRow * 8 + fromCol;
          const p2 = detourRow * 8 + targetCol;

          paths.push({
            name:
              "three-move rank detour via " +
              this.squareToCoord(p1) +
              " and " +
              this.squareToCoord(p2),
            from,
            target,
            emptyMoves: 3,
            pivots: [p1, p2],
            segments: [
              { from, to: p1 },
              { from: p1, to: p2 },
              { from: p2, to: target }
            ]
          });
        }
      }

      return paths;
    }

    const pivotA = fromRow * 8 + targetCol;
    const pivotB = targetRow * 8 + fromCol;

    paths.push({
      name: "L-path via " + this.squareToCoord(pivotA),
      from,
      target,
      emptyMoves: 2,
      pivots: [pivotA],
      segments: [
        { from, to: pivotA },
        { from: pivotA, to: target }
      ]
    });

    paths.push({
      name: "L-path via " + this.squareToCoord(pivotB),
      from,
      target,
      emptyMoves: 2,
      pivots: [pivotB],
      segments: [
        { from, to: pivotB },
        { from: pivotB, to: target }
      ]
    });

    return paths;
  }

  analyzeRookCandidatePath(path) {
    const travelSquares = this.getRookPathTravelSquares(path);
    const travelSet = new Set(travelSquares);

    const blockers = [];
    let extraBlockerCost = 0;
    let fullyClearable = true;
    const partialClearance = [];

    for (const square of travelSquares) {
      const piece = this.board[square];

      if (!piece) continue;

      const color = this.getColor(piece);
      const isPivot = path.pivots.includes(square);

      if (color === "b") {
        const cost = isPivot ? 0 : 1;

        blockers.push({
          square,
          coord: this.squareToCoord(square),
          piece,
          color,
          type: "enemy",
          isPivot,
          cost,
          note: isPivot
            ? "Enemy piece is on a planned pivot square; the rook captures it as part of the normal pivot move."
            : "Enemy piece blocks the rook path and costs one extra capture move."
        });

        extraBlockerCost += cost;
        continue;
      }

      if (color === "w") {
        const clearance = this.friendlyBlockerClearanceEstimate(
          piece,
          square,
          travelSet
        );

        blockers.push({
          square,
          coord: this.squareToCoord(square),
          piece,
          color,
          type: "friendly",
          isPivot,
          cost: clearance.cost,
          clearsInOne: clearance.clearsInOne,
          partial: clearance.partial,
          clearDestinations: clearance.clearDestinations,
          partialDestinations: clearance.partialDestinations,
          note: clearance.note
        });

        if (Number.isFinite(clearance.cost) && clearance.clearsInOne) {
          extraBlockerCost += clearance.cost;
        } else {
          fullyClearable = false;

          if (clearance.partial) {
            partialClearance.push({
              square,
              coord: this.squareToCoord(square),
              piece,
              partialDestinations: clearance.partialDestinations,
              note: clearance.note
            });
          }
        }
      }
    }

    return {
      name: path.name,
      emptyMoves: path.emptyMoves,
      pivots: path.pivots.map(sq => this.squareToCoord(sq)),
      travelSquares: travelSquares.map(sq => this.squareToCoord(sq)),
      blockers,
      extraBlockerCost,
      fullyClearable,
      partialClearance,
      totalEstimatedMoves: fullyClearable
        ? path.emptyMoves + extraBlockerCost
        : Infinity
    };
  }

  getRookPathTravelSquares(path) {
    const squares = [];

    for (const segment of path.segments) {
      squares.push(...this.lineBetweenStrict(segment.from, segment.to));

      if (
        path.pivots.includes(segment.to) &&
        segment.to !== path.from &&
        segment.to !== path.target
      ) {
        squares.push(segment.to);
      }
    }

    return this.dedupeSquares(squares);
  }

  friendlyBlockerClearanceEstimate(piece, square, forbiddenSet) {
    if (piece === "wK") {
      return {
        cost: Infinity,
        clearsInOne: false,
        partial: false,
        clearDestinations: [],
        partialDestinations: [],
        note: "White king clearance is not modeled here."
      };
    }

    const destinations = this.getFormulaPseudoDestinationsForPiece(piece, square);

    const clearDestinations = destinations.filter(dest =>
      !forbiddenSet.has(dest)
    );

    if (clearDestinations.length > 0) {
      return {
        cost: 1,
        clearsInOne: true,
        partial: false,
        clearDestinations: clearDestinations.map(sq => this.squareToCoord(sq)),
        partialDestinations: [],
        note: "Friendly blocker can move off the rook path in one move."
      };
    }

    const partialDestinations = destinations.filter(dest =>
      forbiddenSet.has(dest)
    );

    if (partialDestinations.length > 0) {
      return {
        cost: Infinity,
        clearsInOne: false,
        partial: true,
        clearDestinations: [],
        partialDestinations: partialDestinations.map(sq => this.squareToCoord(sq)),
        note:
          "Friendly blocker can move, but it remains on the rook path. This may ease the path locally, but it does not fully clear this formulaic path."
      };
    }

    return {
      cost: Infinity,
      clearsInOne: false,
      partial: false,
      clearDestinations: [],
      partialDestinations: [],
      note: "Friendly blocker has no one-move way to leave this rook path."
    };
  }

  getFormulaPseudoDestinationsForPiece(piece, from) {
    const type = this.getType(piece);

    if (type === "P") {
      return this.getFormulaPawnDestinations(piece, from);
    }

    if (type === "N") {
      return this.getFormulaKnightDestinations(piece, from);
    }

    if (type === "B") {
      return this.getFormulaSlidingDestinations(piece, from, [
        [1, 1], [1, -1], [-1, 1], [-1, -1]
      ]);
    }

    if (type === "R") {
      return this.getFormulaSlidingDestinations(piece, from, [
        [1, 0], [-1, 0], [0, 1], [0, -1]
      ]);
    }

    if (type === "Q") {
      return this.getFormulaSlidingDestinations(piece, from, [
        [1, 1], [1, -1], [-1, 1], [-1, -1],
        [1, 0], [-1, 0], [0, 1], [0, -1]
      ]);
    }

    return [];
  }

  getFormulaPawnDestinations(piece, from) {
    const color = this.getColor(piece);
    const row = this.squareRow(from);
    const col = this.squareCol(from);

    const direction = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;

    const result = [];

    const oneRow = row + direction;

    if (this.inBounds(oneRow, col)) {
      const one = oneRow * 8 + col;

      if (!this.board[one]) {
        result.push(one);

        const twoRow = row + direction * 2;

        if (row === startRow && this.inBounds(twoRow, col)) {
          const two = twoRow * 8 + col;

          if (!this.board[two]) {
            result.push(two);
          }
        }
      }
    }

    for (const dc of [-1, 1]) {
      const captureRow = row + direction;
      const captureCol = col + dc;

      if (!this.inBounds(captureRow, captureCol)) continue;

      const target = captureRow * 8 + captureCol;
      const occupant = this.board[target];

      if (occupant && this.getColor(occupant) !== color) {
        result.push(target);
      }
    }

    return result;
  }

  getFormulaKnightDestinations(piece, from) {
    const color = this.getColor(piece);
    const row = this.squareRow(from);
    const col = this.squareCol(from);

    const jumps = [
      [2, 1], [2, -1],
      [-2, 1], [-2, -1],
      [1, 2], [1, -2],
      [-1, 2], [-1, -2]
    ];

    const result = [];

    for (const [dr, dc] of jumps) {
      const r = row + dr;
      const c = col + dc;

      if (!this.inBounds(r, c)) continue;

      const target = r * 8 + c;
      const occupant = this.board[target];

      if (!occupant || this.getColor(occupant) !== color) {
        result.push(target);
      }
    }

    return result;
  }

  getFormulaSlidingDestinations(piece, from, directions) {
    const color = this.getColor(piece);
    const row = this.squareRow(from);
    const col = this.squareCol(from);

    const result = [];

    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;

      while (this.inBounds(r, c)) {
        const target = r * 8 + c;
        const occupant = this.board[target];

        if (!occupant) {
          result.push(target);
        } else {
          if (this.getColor(occupant) !== color) {
            result.push(target);
          }

          break;
        }

        r += dr;
        c += dc;
      }
    }

    return result;
  }
}

if (typeof window !== "undefined") {
  window.ChessEngine = ChessEngine;
}

if (typeof module !== "undefined") {
  module.exports = ChessEngine;
}
