import { useState, useEffect } from "react";
import { getOrderedItems, saveOrder } from "../config/mobileMenuItems";

export default function MobileMenuSettings({ items, defaultOrder, storageKey }) {
  const [orderedItems, setOrderedItems] = useState(() =>
    getOrderedItems(items, defaultOrder, storageKey)
  );

  useEffect(() => {
    const refresh = () => setOrderedItems(getOrderedItems(items, defaultOrder, storageKey));
    window.addEventListener("mobile-menu-updated", refresh);
    return () => window.removeEventListener("mobile-menu-updated", refresh);
  }, [items, defaultOrder, storageKey]);

  const move = (index, direction) => {
    const next = [...orderedItems];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrderedItems(next);
    saveOrder(storageKey, next.map(i => i.key));
  };

  const resetToDefault = () => {
    localStorage.removeItem(storageKey);
    const itemMap = Object.fromEntries(items.map(i => [i.key, i]));
    const reset = defaultOrder.map(k => itemMap[k]);
    setOrderedItems(reset);
    window.dispatchEvent(new CustomEvent("mobile-menu-updated"));
  };

  const isDefault = orderedItems.every((item, i) => item.key === defaultOrder[i]);

  return (
    <div className="mobile-menu-settings">
      <style>{`.mobile-menu-settings { display: none; flex-direction: column; gap: 10px; } @media (max-width: 768px) { .mobile-menu-settings { display: flex; } }`}</style>
      <div style={styles.card}>
        <div style={styles.titleRow}>
          <p style={styles.title}>Mobile Menu</p>
          {!isDefault && (
            <button onClick={resetToDefault} style={styles.resetLink}>
              Reset to default
            </button>
          )}
        </div>
        <p style={styles.hint}>Top 3 items appear in the bottom navigation bar. The rest go in the menu.</p>
        <div style={styles.list}>
          {orderedItems.map((item, index) => (
            <div key={item.key}>
              {index === 3 && (
                <div style={styles.divider}>
                  <span style={styles.dividerLabel}>Menu items</span>
                </div>
              )}
              <div style={{
                ...styles.row,
                ...(index < 3 ? styles.navRow : styles.menuRow),
              }}>
                <span style={styles.label}>{item.label}</span>
                <div style={styles.rowRight}>
                  {index < 3 && <span style={styles.badge}>NAV</span>}
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    style={{ ...styles.arrowBtn, opacity: index === 0 ? 0.25 : 1 }}
                    aria-label={`Move ${item.label} up`}
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === orderedItems.length - 1}
                    style={{ ...styles.arrowBtn, opacity: index === orderedItems.length - 1 ? 0.25 : 1 }}
                    aria-label={`Move ${item.label} down`}
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  section: { display: "flex", flexDirection: "column", gap: "10px" },
  card: {
    backgroundColor: "#ffffff", border: "1px solid #E8E8E6", borderRadius: "8px",
    padding: "20px", display: "flex", flexDirection: "column", gap: "12px",
  },
  titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: "16px", fontWeight: 700, color: "#1A1A1A" },
  hint: { fontSize: "13px", color: "#767676", lineHeight: "1.4" },
  list: { display: "flex", flexDirection: "column", gap: "6px" },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 12px", borderRadius: "8px",
  },
  navRow: {
    backgroundColor: "#F0FDF4", border: "1px solid #D1FAE5",
  },
  menuRow: {
    backgroundColor: "#ffffff", border: "1px solid #E8E8E6",
  },
  rowRight: { display: "flex", alignItems: "center", gap: "8px" },
  label: { fontSize: "15px", fontWeight: 500, color: "#1A1A1A" },
  badge: {
    fontSize: "11px", fontWeight: 700, color: "#16A34A",
    backgroundColor: "#DCFCE7", padding: "2px 8px", borderRadius: "4px",
    letterSpacing: "0.5px",
  },
  arrowBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "34px", height: "34px",
    background: "#ffffff", border: "1px solid #E0E0DC", borderRadius: "6px",
    cursor: "pointer", color: "#374151", fontSize: "12px",
    fontFamily: "'DM Sans', sans-serif",
    transition: "background 0.15s",
  },
  divider: {
    borderTop: "1.5px dashed #D1D5DB", margin: "4px 0", position: "relative",
    display: "flex", justifyContent: "center",
  },
  dividerLabel: {
    fontSize: "12px", fontWeight: 500, color: "#9CA3AF",
    backgroundColor: "#ffffff", padding: "0 10px", position: "relative", top: "-9px",
  },
  resetLink: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: "13px", color: "#367C2B", fontWeight: 500, textDecoration: "underline",
    fontFamily: "'DM Sans', sans-serif", padding: 0,
  },
};
