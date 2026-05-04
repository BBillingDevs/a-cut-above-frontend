// src/pages/public/AboutPage.tsx

import React, { useMemo, useState } from "react";
import { Card, Col, Grid, Modal, Row, Typography } from "antd";

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

// Put your images in:
// public/about/about-1.jpg
// public/about/about-2.jpg
// public/about/about-3.jpg
const ABOUT_IMAGES = [
  "/about/about-1.jpg",
  "/about/about-2.jpg",
  "/about/about-3.jpg",
];

type MeatCategoryInfo = {
  title: string;
  paragraphs: string[];
};
const MEAT_CATEGORY_INFO: MeatCategoryInfo[] = [
  {
    title: "Beef",
    paragraphs: [
      "Our beef is grass-fed and pasture-finished, coming from a carefully selected mix of Boran, Beefmaster, and Brahman crossbreeds—animals well suited to our environment and known for their resilience and quality.",
      "Our herd consists of both cattle we raise ourselves and animals sourced from trusted neighbouring farms. Any cattle we purchase are strictly grass-fed and we finish them ourselves on pasture in the same way as our own cattle. Throughout their lives, our cattle roam freely and graze naturally.",
      "All of our cows roam freely and graze on grass throughout their lives. However, during the winter months, when pasture quality declines, we may supplement their diet with silage, minerals, or other mixed variety green crops that we grow and graze the cattle on, to ensure they continue to receive the nutrients they need. These mixed green crops that are grazed are varieties such as buckwheat, rye grass, sorghum, suunhemp etc.",
      "However the cattle are grazed freely on these crops, as they are on the grass pastures. They are not put into confined spaces, fed grains and processed feed and given hormones as other producers do. We are strictly hormone-free!!!",
      "So, while our cattle are grass-fed for most of their lives, we avoid describing them as grass-fed finished, since their diet can include these natural supplements during certain times of the year.",
    ],
  },
  {
    title: "Pork",
    paragraphs: [
      "Our pork comes primarily from pigs we raise ourselves, using a cross of Duroc, Mukota, and Large White breeds. They are fed a balanced diet of maize, soya, and a vitamin mix, along with additional natural supplements such as avocado pulp, peanuts, and maputi to ensure they receive the nutrients they need.",
      "Just as important as what they eat is how they live. Our pigs spend their days freely roaming, rooting and foraging on the land, taking long mud baths, and living socially in a low-stress environment. This natural lifestyle contributes not only to their wellbeing but also to the depth of flavour and quality of the pork.",
    ],
  },
  {
    title: "Lamb",
    paragraphs: [
      "Our lamb is sourced locally from a trusted neighbouring farm across the river, where the sheep are raised free-range and allowed to graze naturally on open pasture.",
    ],
  },
  {
    title: "Chickens",
    paragraphs: [
      "Our chickens come from a trusted local farming project that aligns with our approach to ethical and responsible production, and are raised without the use of hormones or brining.",
    ],
  },
];

export default function AboutPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [hiddenImages, setHiddenImages] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const visibleImages = useMemo(
    () => ABOUT_IMAGES.filter((src) => !hiddenImages[src]),
    [hiddenImages],
  );

  return (
    <div className="aca-page">
      <div className="aca-page__top">
        <Title
          level={2}
          className="aca-displayTitle"
          style={{ marginBottom: 4 }}
        >
          About Us
        </Title>

        <Text className="aca-subtitle">
          A small, family-run farm with a passion for ethical meat production.
        </Text>
      </div>

      <Row gutter={[18, 18]} style={{ marginTop: 18 }}>
        <Col xs={24} lg={15}>
          <Card
            className="aca-sidebarCard"
            style={{ borderRadius: 18 }}
            styles={{
              body: {
                padding: isMobile ? 16 : 26,
              },
            }}
          >
            <Title level={3} style={{ marginTop: 0 }}>
              Our Story
            </Title>

            <Paragraph style={{ lineHeight: 1.8 }}>
              A Cut Above is a small, family-run business that began quite
              unexpectedly. What started as a debt repayment, in the form of
              cattle, has, five years later, grown into a thriving herd and a
              deeply rooted passion for farming.
            </Paragraph>

            <Paragraph style={{ lineHeight: 1.8 }}>
              While we love great meat, we also believe the industry can be more
              balanced. For us, that means raising animals with care and
              respect, giving them a life that reflects the values we stand for.
            </Paragraph>

            <Paragraph style={{ lineHeight: 1.8, marginBottom: 0 }}>
              We are on a journey to bring more ethical and transparent
              standards to meat production in Zimbabwe, offering produce that is
              responsibly raised and rooted in honesty, from our farm to your
              plate.
            </Paragraph>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card
            className="aca-sidebarCard"
            style={{ borderRadius: 18 }}
            styles={{
              body: {
                padding: isMobile ? 16 : 22,
              },
            }}
          >
            <Title level={3} style={{ marginTop: 0 }}>
              Our Values
            </Title>

            <div style={{ display: "grid", gap: 12 }}>
              {[
                {
                  title: "Respect for animals",
                  text: "We believe animals should be raised with care, space and dignity.",
                },
                {
                  title: "Honest farming",
                  text: "We want customers to understand where their food comes from and how it was raised.",
                },
                {
                  title: "Responsible production",
                  text: "We are working towards more ethical and transparent meat production in Zimbabwe.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    border: "1px solid var(--aca-border)",
                    background: "var(--aca-bg2)",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 900,
                      color: "var(--aca-forest)",
                      marginBottom: 4,
                    }}
                  >
                    {item.title}
                  </div>

                  <Text style={{ lineHeight: 1.6 }}>{item.text}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {visibleImages.length > 0 ? (
        <Card
          className="aca-sidebarCard"
          style={{ marginTop: 18, borderRadius: 18 }}
          styles={{
            body: {
              padding: isMobile ? 16 : 22,
            },
          }}
        >
          <Title level={3} style={{ marginTop: 0 }}>
            From the Farm
          </Title>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "1fr"
                : `repeat(${Math.min(visibleImages.length, 3)}, 1fr)`,
              gap: 12,
            }}
          >
            {visibleImages.slice(0, 3).map((src, index) => (
              <button
                key={src}
                type="button"
                onClick={() =>
                  setPreviewImage({
                    src,
                    alt: `A Cut Above farm image ${index + 1}`,
                  })
                }
                style={{
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  cursor: "zoom-in",
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                <img
                  src={src}
                  alt={`A Cut Above farm image ${index + 1}`}
                  style={{
                    width: "100%",
                    height: isMobile ? 220 : 240,
                    objectFit: "cover",
                    display: "block",
                  }}
                  onError={() => {
                    setHiddenImages((prev) => ({
                      ...prev,
                      [src]: true,
                    }));
                  }}
                />
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <Card
        className="aca-sidebarCard"
        style={{ marginTop: 18, borderRadius: 18 }}
        styles={{
          body: {
            padding: isMobile ? 16 : 26,
          },
        }}
      >
        <Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
          Our Meat
        </Title>

        <Text
          type="secondary"
          style={{
            display: "block",
            marginBottom: 18,
            lineHeight: 1.65,
          }}
        >
          We believe customers should know how their meat is raised, sourced and
          produced. Here is how we approach each category.
        </Text>

        <Row gutter={[16, 16]}>
          {MEAT_CATEGORY_INFO.map((info) => (
            <Col xs={24} lg={12} key={info.title}>
              <div
                style={{
                  height: "100%",
                  border: "1px solid var(--aca-border)",
                  background: "var(--aca-bg2)",
                  borderRadius: 16,
                  padding: isMobile ? 14 : 18,
                }}
              >
                <Title level={4} style={{ marginTop: 0, marginBottom: 10 }}>
                  {info.title}
                </Title>

                <div style={{ display: "grid", gap: 10 }}>
                  {info.paragraphs.map((paragraph) => (
                    <Text
                      key={paragraph}
                      style={{
                        display: "block",
                        lineHeight: 1.7,
                      }}
                    >
                      {paragraph}
                    </Text>
                  ))}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Modal
        open={!!previewImage}
        footer={null}
        onCancel={() => setPreviewImage(null)}
        centered
        width={900}
        destroyOnHidden
        styles={{
          body: {
            padding: 0,
            background: "transparent",
          },
        }}
      >
        {previewImage ? (
          <img
            src={previewImage.src}
            alt={previewImage.alt}
            style={{
              width: "100%",
              maxHeight: "82vh",
              objectFit: "contain",
              display: "block",
              borderRadius: 12,
              background: "#fff",
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
