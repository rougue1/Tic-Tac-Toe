import React from "react";
import Cell from "./Cell";
import styles from "./Board.module.css";
import { Game } from "../../types"; // Assuming Game type has 'board' as string[]

interface BoardProps {
    board: string[]; // Array of 9: 'X', 'O', or ' '
    onCellClick: (index: number) => void;
    disabled: boolean; // True if it's not player's turn or game over
}

const Board: React.FC<BoardProps> = ({ board, onCellClick, disabled }) => {
    return (
        <div className={styles.board}>
            {board.map((cellValue, index) => (
                <Cell key={index} value={cellValue as "X" | "O" | " "} onClick={() => onCellClick(index)} disabled={disabled || cellValue !== " "} />
            ))}
        </div>
    );
};

export default Board;
