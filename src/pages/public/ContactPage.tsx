// src/pages/public/ContactPage.tsx

import React, { useMemo } from "react";
import { Button, Card, Col, Grid, Row, Space, Typography, message } from "antd";
import {
  MailOutlined,
  WhatsAppOutlined,
  CopyOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

function buildEmail() {
  const nameParts = ["karina", "kozlowska", "zim"];
  const domainParts = ["gmail", "com"];

  return `${nameParts.join(".")}@${domainParts.join(".")}`;
}

function buildWhatsAppNumber() {
  const parts = ["263", "78", "220", "6618"];

  return parts.join("");
}

function displayWhatsAppHint() {
  return "WhatsApp us directly using the button below.";
}

function displayEmailHint() {
  return "Email us directly using the button below.";
}

export default function ContactPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const whatsappMessage = useMemo(
    () =>
      encodeURIComponent("Hello A Cut Above, I would like to ask a question."),
    [],
  );

  function openEmail() {
    const email = buildEmail();
    const subject = encodeURIComponent("Website enquiry from A Cut Above");

    window.location.href = `mailto:${email}?subject=${subject}`;
  }

  function openWhatsApp() {
    const number = buildWhatsAppNumber();

    window.open(
      `https://wa.me/${number}?text=${whatsappMessage}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(buildEmail());
      message.success("Email address copied.");
    } catch {
      message.error("Could not copy email address.");
    }
  }

  async function copyWhatsApp() {
    try {
      await navigator.clipboard.writeText(`+${buildWhatsAppNumber()}`);
      message.success("WhatsApp number copied.");
    } catch {
      message.error("Could not copy WhatsApp number.");
    }
  }

  return (
    <div className="aca-page">
      <div className="aca-page__top">
        <Title
          level={2}
          className="aca-displayTitle"
          style={{ marginBottom: 4 }}
        >
          Contact Us
        </Title>

        <Text className="aca-subtitle">
          Have a question about orders, delivery or our products? Get in touch
          with us directly.
        </Text>
      </div>

      <Row gutter={[18, 18]} style={{ marginTop: 18 }} align="stretch">
        <Col xs={24}>
          <Card
            className="aca-sidebarCard"
            style={{ width: "100%", borderRadius: 18 }}
            styles={{
              body: {
                padding: isMobile ? 16 : 26,
              },
            }}
          >
            <Title level={3} style={{ marginTop: 0 }}>
              Get in Touch
            </Title>

            <Paragraph style={{ lineHeight: 1.75 }}>
              For orders, delivery questions, product availability or general
              enquiries, please contact us by WhatsApp or email.
            </Paragraph>

            <Paragraph style={{ lineHeight: 1.75, marginBottom: 0 }}>
              For order-specific questions, please include your name, delivery
              location and order details so we can help you faster.
            </Paragraph>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 14,
                marginTop: 22,
              }}
            >
              <div
                style={{
                  border: "1px solid var(--aca-border)",
                  background: "var(--aca-bg2)",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  WhatsApp
                </Text>

                <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                  Send us a WhatsApp message
                </Title>

                <Text
                  style={{
                    display: "block",
                    lineHeight: 1.6,
                    marginBottom: 12,
                  }}
                >
                  {displayWhatsAppHint()}
                </Text>

                <Space wrap>
                  <Button
                    type="primary"
                    icon={<WhatsAppOutlined />}
                    onClick={openWhatsApp}
                  >
                    Open WhatsApp
                  </Button>

                  <Button icon={<CopyOutlined />} onClick={copyWhatsApp}>
                    Copy Number
                  </Button>
                </Space>
              </div>

              <div
                style={{
                  border: "1px solid var(--aca-border)",
                  background: "var(--aca-bg2)",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Email
                </Text>

                <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                  Send us an email
                </Title>

                <Text
                  style={{
                    display: "block",
                    lineHeight: 1.6,
                    marginBottom: 12,
                  }}
                >
                  {displayEmailHint()}
                </Text>

                <Space wrap>
                  <Button
                    type="primary"
                    icon={<MailOutlined />}
                    onClick={openEmail}
                  >
                    Open Email
                  </Button>

                  <Button icon={<CopyOutlined />} onClick={copyEmail}>
                    Copy Email
                  </Button>
                </Space>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
