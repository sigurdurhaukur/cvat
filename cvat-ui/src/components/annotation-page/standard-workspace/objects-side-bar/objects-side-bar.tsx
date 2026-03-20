// Copyright (C) 2020-2022 Intel Corporation
// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React, {
    Dispatch, useCallback, useEffect, useRef, useState,
} from 'react';
import { AnyAction } from 'redux';
import { connect } from 'react-redux';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import Tabs from 'antd/lib/tabs';
import Layout from 'antd/lib/layout';

import { CombinedState } from 'reducers';
import { DimensionType } from 'cvat-core-wrapper';
import LabelsList from 'components/annotation-page/standard-workspace/objects-side-bar/labels-list';
import { collapseSidebar as collapseSidebarAction } from 'actions/annotation-actions';
import AppearanceBlock from 'components/annotation-page/appearance-block';
import IssuesListComponent from 'components/annotation-page/standard-workspace/objects-side-bar/issues-list';

interface OwnProps {
    objectsList: JSX.Element;
}

interface StateToProps {
    sidebarCollapsed: boolean;
    jobInstance: any;
}

interface DispatchToProps {
    collapseSidebar(): void;
}

const DEFAULT_SIDEBAR_WIDTH = 300;
const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH_RATIO = 0.6;
const SIDEBAR_WIDTH_LOCAL_STORAGE_KEY = 'cvat-objects-sidebar-width';

function clampSidebarWidth(width: number): number {
    const maxSidebarWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.floor(window.innerWidth * MAX_SIDEBAR_WIDTH_RATIO));
    return Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), maxSidebarWidth);
}

function getInitialSidebarWidth(): number {
    const savedWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_LOCAL_STORAGE_KEY));

    if (!Number.isFinite(savedWidth) || savedWidth <= 0) {
        return DEFAULT_SIDEBAR_WIDTH;
    }

    return clampSidebarWidth(savedWidth);
}

function mapStateToProps(state: CombinedState): StateToProps {
    const {
        annotation: {
            sidebarCollapsed,
            job: { instance: jobInstance },
        },
    } = state;

    return {
        sidebarCollapsed,
        jobInstance,
    };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>): DispatchToProps {
    return {
        collapseSidebar(): void {
            dispatch(collapseSidebarAction());
        },
    };
}

function ObjectsSideBar(props: StateToProps & DispatchToProps & OwnProps): JSX.Element {
    const {
        sidebarCollapsed, collapseSidebar, objectsList, jobInstance,
    } = props;
    const resizeDataRef = useRef<{ startX: number; startWidth: number } | null>(null);
    const [sidebarWidth, setSidebarWidth] = useState<number>(getInitialSidebarWidth);

    const stopResize = useCallback((): void => {
        resizeDataRef.current = null;
        window.document.body.style.removeProperty('cursor');
        window.document.body.style.removeProperty('user-select');
        window.removeEventListener('mousemove', resize);
        window.removeEventListener('mouseup', stopResize);
    }, []);

    const resize = useCallback((event: MouseEvent): void => {
        if (!resizeDataRef.current) {
            return;
        }

        const { startX, startWidth } = resizeDataRef.current;
        const nextWidth = clampSidebarWidth(startWidth + startX - event.clientX);
        setSidebarWidth(nextWidth);
    }, []);

    const startResize = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
        resizeDataRef.current = {
            startX: event.clientX,
            startWidth: sidebarWidth,
        };

        window.document.body.style.cursor = 'col-resize';
        window.document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResize);

        event.preventDefault();
        event.stopPropagation();
    }, [resize, sidebarWidth, stopResize]);

    useEffect(() => (): void => {
        stopResize();
    }, [stopResize]);

    useEffect(() => {
        window.localStorage.setItem(SIDEBAR_WIDTH_LOCAL_STORAGE_KEY, `${sidebarWidth}`);
        if (!sidebarCollapsed) {
            window.dispatchEvent(new Event('resize'));
        }
    }, [sidebarCollapsed, sidebarWidth]);

    const collapse = (): void => {
        const [collapser] = window.document.getElementsByClassName('cvat-objects-sidebar');
        const listener = (event: Event): void => {
            const transitionEvent = event as TransitionEvent;

            if (event.target && transitionEvent.propertyName === 'width' && event.target === collapser) {
                window.dispatchEvent(new Event('resize'));
                (collapser as HTMLElement).removeEventListener('transitionend', listener as any);
            }
        };

        if (collapser) {
            (collapser as HTMLElement).addEventListener('transitionend', listener as any);
        }

        collapseSidebar();
    };

    const is2D = jobInstance ? jobInstance.dimension === DimensionType.DIMENSION_2D : true;
    return (
        <Layout.Sider
            className='cvat-objects-sidebar'
            theme='light'
            width={sidebarWidth}
            collapsedWidth={0}
            reverseArrow
            collapsible
            trigger={null}
            collapsed={sidebarCollapsed}
        >
            {!sidebarCollapsed && (
                <div
                    className='cvat-objects-sidebar-resizer'
                    onMouseDown={startResize}
                />
            )}
            {/* eslint-disable-next-line */}
            <span
                className='cvat-objects-sidebar-sider'
                onClick={collapse}
            >
                {sidebarCollapsed ? <MenuFoldOutlined title='Show' /> : <MenuUnfoldOutlined title='Hide' />}
            </span>

            <Tabs
                type='card'
                defaultActiveKey='objects'
                className='cvat-objects-sidebar-tabs'
                items={[{
                    key: 'objects',
                    label: 'Objects',
                    children: objectsList,
                }, {
                    key: 'labels',
                    label: 'Labels',
                    forceRender: true,
                    children: <LabelsList />,
                }, ...(is2D ? [{ key: 'issues', label: 'Issues', children: <IssuesListComponent /> }] : [])]}
            />
            {!sidebarCollapsed && <AppearanceBlock />}
        </Layout.Sider>
    );
}

export default connect(mapStateToProps, mapDispatchToProps)(React.memo(ObjectsSideBar));
