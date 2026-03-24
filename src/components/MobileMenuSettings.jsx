import { useState, useEffect } from "react";
import { getOrderedItems, saveOrder } from "../config/mobileMenuItems";

const ARROW_UP = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

const ARROW_DOWN = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

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
    <div style={styles.section}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={styles.sectionTitle}>Mobile Menu</p>
        {!isDefault && (
          <button onClick={resetToDefault} style={styles.resetLink}>
            Reset to default
          </button>
        )}
      </div>
      <div style={styles.card}>
        <p style={styles.hint}>Top 3 items appear in the bottom navigation bar. Remaining items go in the menu.</p>
        {orderedItems.map((item, index) => (
          <div key={item.key}>
            {index === 3 && <div style={styles.divider}><span style={styles.dividerLabel}>MENU</span></div>}
            <div style={{
              ...styles.row,
              ...(index < 3 ? styles.navRow : {}),
            }}>
              <div style={styles.rowLeft}>
                <span style={styles.icon}>{item.icon}</span>
                <span style={styles.label}>{item.label}</span>
                {index < 3 && <span style={styles.badge}>NAV</span>}
              </div>
              <div style={styles.arrows}>
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  style={{ ...styles.arrowBtn, opacity: index === 0 ? 0.25 : 1 }}
                  aria-label={`Move ${item.label} up`}
                >
                  {ARROW_UP}
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === orderedItems.length - 1}
                  style={{ ...styles.arrowBtn, opacity: index === orderedItems.length - 1 ? 0.25 : 1 }}
                  aria-label={`Move ${item.label} down`}
                >
                  {ARROW_DOWN}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  section: { display: "flex", flexDirection: "column", gap: "10px" },
  sectionTitle: { fontSize: "13px", fontWeight: 600, color: "#374151" },
  card: {
    backgroundColor: "#ffffff", border: "1px solid #E8E8E6", borderRadius: "8px",
    padding: "16px", display: "flex", flexDirection: "column", gap: "0px",
  },
  hint: { fontSize: "12px", color: "#767676", marginBottom: "8px" },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 8px", borderRadius: "6px", transition: "background 0.15s",
  },
  navRow: {
    backgroundColor: "#F0FDF4",
  },
  rowLeft: { display: "flex", alignItems: "center", gap: "10px" },
  icon: { color: "#374151", display: "flex", alignItems: "center" },
  label: { fontSize: "14px", fontWeight: 500, color: "#1A1A1A" },
  badge: {
    fontSize: "10px", fontWeight: 700, color: "#16A34A",
    backgroundColor: "#DCFCE7", padding: "2px 6px", borderRadius: "4px",
    letterSpacing: "0.5px",
  },
  arrows: { display: "flex", gap: "4px" },
  arrowBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "32px", height: "32px",
    background: "none", border: "1px solid #E0E0DC", borderRadius: "6px",
    cursor: "pointer", color: "#374151", transition: "background 0.15s",
  },
  divider: {
    borderTop: "2px dashed #E0E0DC", margin: "6px 0", position: "relative",
    display: "flex", justifyContent: "center",
  },
  dividerLabel: {
    fontSize: "10px", fontWeight: 700, color: "#9CA3AF", letterSpacing: "1px",
    backgroundColor: "#ffffff", padding: "0 8px", position: "relative", top: "-8px",
  },
  resetLink: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: "12px", color: "#367C2B", fontWeight: 500, textDecoration: "underline",
    fontFamily: "'DM Sans', sans-serif", padding: 0,
  },
};
