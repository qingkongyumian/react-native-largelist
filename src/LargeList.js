/*
 *
 * Created by Stone
 * https://github.com/bolan9999
 * Email: shanshang130@gmail.com
 * Date: 2018/7/17
 *
 */

import React from "react";
import { Animated, StyleSheet, Dimensions } from "react-native";
import { styles } from "./styles";
import { SpringScrollView } from "react-native-spring-scrollview";
import type { IndexPath, LargeListPropType, Offset } from "./Types";
import { Group } from "./Group";
import { SectionContainer } from "./SectionContainer";
import { idx } from "./idx";

export class LargeList extends React.PureComponent<LargeListPropType> {
  _groupRefs = [];
  _offset: Animated.Value;
  _sectionContainer = React.createRef();
  _scrollView = React.createRef();
  _shouldUpdateContent = true;
  _lastTick = 0;
  _contentOffsetY = 0;
  _headerLayout;
  _footerLayout;
  _nativeOffset;

  static defaultProps = {
    heightForSection: () => 0,
    renderSection: () => null,
    groupCount: 4,
    groupMinHeight: Dimensions.get("window").height / 3,
    updateTimeInterval: 150
  };

  constructor(props) {
    super(props);
    for (let i = 0; i < props.groupCount; ++i) {
      this._groupRefs.push(React.createRef());
    }
    this.obtainOffset();
  }

  componentWillReceiveProps(props: LargeListPropType) {
    if (
      props.onNativeContentOffsetExtract &&
      this.props.onNativeContentOffsetExtract !==
        props.onNativeContentOffsetExtract
    ) {
      this.obtainOffset();
    }
  }

  obtainOffset() {
    this._nativeOffset = {
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      ...this.props.onNativeContentOffsetExtract
    };
    this._offset = this._nativeOffset.y;
  }

  render() {
    const {
      style,
      data,
      heightForSection,
      heightForIndexPath,
      groupMinHeight,
      groupCount,
      renderHeader,
      renderFooter
    } = this.props;
    const groupIndexes = [];
    let indexes = [];
    const sectionTops = [];
    let currentGroupIndex = 0;
    let inputs = [];
    let outputs = [];
    let lastOffset = [];
    let sumHeight = this._headerLayout ? this._headerLayout.height : 0;
    let currentGroupHeight = 0;
    for (let i = 0; i < groupCount; ++i) {
      inputs.push(i === 0 ? [Number.MIN_SAFE_INTEGER] : []);
      outputs.push(i === 0 ? [sumHeight] : []);
      lastOffset.push(sumHeight);
      groupIndexes.push([]);
    }

    const wrapperHeight = idx(() => this._scrollView.current._height, 700);
    for (let section = 0; section < data.length; ++section) {
      for (let row = -1; row < data[section].items.length; ++row) {
        let height;
        if (row === -1) {
          height = heightForSection(section);
          sectionTops[section] = sumHeight;
        } else {
          height = heightForIndexPath({ section: section, row: row });
        }
        currentGroupHeight += height;
        sumHeight += height;
        indexes.push({ section: section, row: row });
        if (
          currentGroupHeight >= groupMinHeight ||
          (section === data.length - 1 &&
            row === data[section].items.length - 1)
        ) {
          groupIndexes[currentGroupIndex].push(indexes);
          indexes = [];
          currentGroupHeight = 0;
          currentGroupIndex++;
          currentGroupIndex %= groupCount;
          if (
            section === data.length - 1 &&
            row === data[section].items.length - 1
          )
            break;
          if (inputs[currentGroupIndex].length === 0) {
            inputs[currentGroupIndex].push(Number.MIN_SAFE_INTEGER);
          }
          inputs[currentGroupIndex].push(sumHeight - wrapperHeight);
          inputs[currentGroupIndex].push(sumHeight + 1 - wrapperHeight);
          if (outputs[currentGroupIndex].length === 0) {
            outputs[currentGroupIndex].push(sumHeight);
            outputs[currentGroupIndex].push(sumHeight);
          } else {
            outputs[currentGroupIndex].push(lastOffset[currentGroupIndex]);
          }
          outputs[currentGroupIndex].push(sumHeight);
          lastOffset[currentGroupIndex] = sumHeight;
        }
      }
    }
    inputs.forEach(range => range.push(Number.MAX_SAFE_INTEGER));
    outputs.forEach(range => range.push(range[range.length - 1]));
    const scrollStyle = StyleSheet.flatten([styles.container, style]);
    if (this._footerLayout) sumHeight += this._footerLayout.height;
    return (
      <SpringScrollView
        {...this.props}
        ref={this._scrollView}
        style={scrollStyle}
        contentStyle={{ height: sumHeight }}
        onNativeContentOffsetExtract={this._nativeOffset}
        onScroll={this._onScroll}
        onMomentumScrollEnd={this._onScrollEnd}
      >
        {renderHeader &&
          <Animated.View onLayout={this._onHeaderLayout}>
            {this.props.renderHeader()}
          </Animated.View>}
        {groupIndexes.map((indexes, index) => {
          const style = {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            transform: [
              {
                translateY:
                  outputs[index].length > 1
                    ? this._offset.interpolate({
                        inputRange: inputs[index],
                        outputRange: outputs[index]
                      })
                    : 0
              }
            ]
          };
          return (
            <Animated.View key={index} style={style}>
              <Group
                {...this.props}
                index={index}
                ref={this._groupRefs[index]}
                indexes={indexes}
                input={inputs[index]}
                output={outputs[index]}
                offset={this._contentOffsetY}
              />
            </Animated.View>
          );
        })}
        <SectionContainer
          {...this.props}
          tops={sectionTops}
          ref={this._sectionContainer}
          nativeOffset={this._offset}
        />
        {renderFooter &&
          <Animated.View style={styles.footer} onLayout={this._onFooterLayout}>
            {renderFooter()}
          </Animated.View>}
      </SpringScrollView>
    );
  }

  _onHeaderLayout = ({ nativeEvent: { layout: layout } }) => {
    this._headerLayout = layout;
    const { renderFooter } = this.props;
    if (!renderFooter || this._footerLayout) {
      this.forceUpdate();
    }
  };

  _onFooterLayout = ({ nativeEvent: { layout: layout } }) => {
    this._footerLayout = layout;
    const { renderHeader } = this.props;
    if (!renderHeader || this._headerLayout) {
      this.forceUpdate();
    }
  };

  _onScrollEnd = () => {
    this._groupRefs.forEach(group =>
      idx(() => group.current.contentConversion(this._contentOffsetY))
    );
    idx(() =>
      this._sectionContainer.current.updateOffset(this._contentOffsetY)
    );
  };

  _onScroll = e => {
    const offsetY = e.nativeEvent.contentOffset.y;
    this._contentOffsetY = offsetY;
    this._shouldUpdateContent &&
      idx(() => this._sectionContainer.current.updateOffset(offsetY));
    const now = new Date().getTime();
    if (this._lastTick - now > 30) {
      this._lastTick = now;
      return;
    }
    this._lastTick = now;
    this._shouldUpdateContent &&
      this._groupRefs.forEach(group =>
        idx(() => group.current.contentConversion(offsetY))
      );
    this.props.onScroll && this.props.onScroll(offset);
  };

  scrollTo(offset: Offset, animated: boolean = true): Promise<void> {
    if (!this._scrollView.current)
      return Promise.reject("LargeList has not been initialized yet!");
    this._shouldUpdateContent = false;
    this._groupRefs.forEach(group =>
      idx(() => group.current.contentConversion(offset.y))
    );
    idx(() => this._sectionContainer.current.updateOffset(offset.y, true));
    return this._scrollView.current.scrollTo(offset, animated).then(() => {
      this._shouldUpdateContent = true;
      return Promise.resolve();
    });
  }

  scrollToIndexPath(
    indexPath: IndexPath,
    animated: boolean = true
  ): Promise<void> {
    const { data, heightForSection, heightForIndexPath } = this.props;
    let ht = 0;
    for (let s = 0; s < data.length && s <= indexPath.section; ++s) {
      if (indexPath.section === s && indexPath.row === -1) break;
      ht += heightForSection(s);
      for (let r = 0; r < data[s].items.length; ++r) {
        if (indexPath.section === s && indexPath.row === r) break;
        ht += heightForIndexPath({ section: s, row: r });
      }
    }
    return this.scrollTo({ x: 0, y: ht }, animated);
  }

  endRefresh() {
    idx(() => this._scrollView.current.endRefresh());
  }

  endLoading(rebound: boolean = false) {
    idx(() => this._scrollView.current.endLoading(rebound));
  }
}
