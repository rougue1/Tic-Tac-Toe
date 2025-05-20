import React from "react";
import styles from "./Cell.module.css";

interface CellProps {
    value: "X" | "O" | " ";
    onClick: () => void;
    disabled: boolean;
}

const Cell: React.FC<CellProps> = ({ value, onClick, disabled }) => {
    return (
        <button
            className={`${styles.cell} ${styles[value]}`} // Apply X or O class for potential styling
            onClick={onClick}
            disabled={disabled || value !== " "} // Disable if already filled or game logic dictates
        >
            {value !== " " ? value : ""}
        </button>
    );
};

export default Cell;
