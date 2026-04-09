import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Input, Space, Typography, message } from "antd";

const { Title, Text } = Typography;

export default function WholesalePinPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");

  const isWholesale = useMemo(
    () => Boolean(localStorage.getItem("aca_wholesale_pin")),
    [],
  );

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "70vh" }}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Title level={3} style={{ marginBottom: 6 }}>
              Wholesale Access
            </Title>
            <Text type="secondary">
              Enter the wholesale PIN to view wholesale pricing.
            </Text>
          </div>

          <Input.Password
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Wholesale PIN"
            autoFocus
            onPressEnter={() => {
              const cleaned = pin.trim();
              if (!cleaned) return message.warning("Please enter a PIN.");
              localStorage.setItem("aca_wholesale_pin", cleaned);
              message.success("Wholesale mode enabled.");
              navigate("/products", { replace: true });
              window.location.reload();
            }}
          />

          <Button
            type="primary"
            block
            onClick={() => {
              const cleaned = pin.trim();
              if (!cleaned) return message.warning("Please enter a PIN.");
              localStorage.setItem("aca_wholesale_pin", cleaned);
              message.success("Wholesale mode enabled.");
              navigate("/products", { replace: true });
              window.location.reload();
            }}
          >
            Enter Wholesale
          </Button>

          {isWholesale ? (
            <Button
              danger
              block
              onClick={() => {
                localStorage.removeItem("aca_wholesale_pin");
                message.info("Exited wholesale mode.");
                navigate("/products", { replace: true });
                window.location.reload();
              }}
            >
              Exit Wholesale
            </Button>
          ) : (
            <Button block onClick={() => navigate("/products")}>
              Back to Shop
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
}
